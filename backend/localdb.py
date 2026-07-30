"""
Lightweight async JSON-backed database used as a local fallback when Mongo/Motor
is unavailable on the machine.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime
import json
from pathlib import Path
import re
from threading import RLock
from types import SimpleNamespace
from typing import Any


def _json_default(value: Any):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def _deepcopy_jsonable(value: Any):
    return json.loads(json.dumps(value, default=_json_default))


def _get_path(document: dict, path: str) -> Any:
    current = document
    for part in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _set_path(document: dict, path: str, value: Any) -> None:
    parts = path.split(".")
    current = document
    for part in parts[:-1]:
        next_value = current.get(part)
        if not isinstance(next_value, dict):
            next_value = {}
            current[part] = next_value
        current = next_value
    current[parts[-1]] = _deepcopy_jsonable(value)


def _delete_path(document: dict, path: str) -> None:
    parts = path.split(".")
    current = document
    for part in parts[:-1]:
        current = current.get(part)
        if not isinstance(current, dict):
            return
    if isinstance(current, dict):
        current.pop(parts[-1], None)


def _project(document: dict, projection: dict | None) -> dict:
    if not projection:
        return _deepcopy_jsonable(document)

    include_fields = [key for key, value in projection.items() if value and key != "_id"]
    exclude_fields = [key for key, value in projection.items() if not value]

    if include_fields:
        projected = {}
        for field in include_fields:
            value = _get_path(document, field)
            if value is not None:
                _set_path(projected, field, value)
    else:
        projected = _deepcopy_jsonable(document)

    for field in exclude_fields:
        _delete_path(projected, field)
    return projected


def _match_operator(actual: Any, operator: str, expected: Any, full_condition: dict) -> bool:
    if operator == "$regex":
        flags = 0
        options = full_condition.get("$options", "")
        if "i" in options:
            flags |= re.IGNORECASE
        return re.search(expected, str(actual or ""), flags) is not None
    if operator == "$options":
        return True
    if operator == "$in":
        if isinstance(actual, list):
            return any(item in expected for item in actual)
        return actual in expected
    if operator == "$ne":
        return actual != expected
    if operator == "$gte":
        return actual is not None and actual >= expected
    if operator == "$gt":
        return actual is not None and actual > expected
    if operator == "$lte":
        return actual is not None and actual <= expected
    if operator == "$lt":
        return actual is not None and actual < expected
    return actual == expected


def _matches(document: dict, query: dict | None) -> bool:
    if not query:
        return True

    for key, expected in query.items():
        if key == "$or":
            if not any(_matches(document, branch) for branch in expected):
                return False
            continue
        if key == "$and":
            if not all(_matches(document, branch) for branch in expected):
                return False
            continue

        actual = _get_path(document, key)
        if isinstance(expected, dict):
            if not all(_match_operator(actual, op, value, expected) for op, value in expected.items()):
                return False
        else:
            if actual != expected:
                return False
    return True


def _sort_key(value: Any):
    if value is None:
        return (1, "")
    return (0, value)


def _extract_upsert_base(query: dict | None) -> dict:
    if not query:
        return {}
    result = {}
    for key, value in query.items():
        if key.startswith("$"):
            continue
        if not isinstance(value, dict):
            _set_path(result, key, value)
    return result


def _apply_update(document: dict, update: dict) -> None:
    for operator, payload in update.items():
        if operator == "$set":
            for key, value in payload.items():
                _set_path(document, key, value)
        elif operator == "$push":
            for key, value in payload.items():
                existing = _get_path(document, key)
                if not isinstance(existing, list):
                    existing = []
                    _set_path(document, key, existing)
                    existing = _get_path(document, key)
                existing.append(_deepcopy_jsonable(value))
        elif operator == "$inc":
            for key, value in payload.items():
                existing = _get_path(document, key)
                base = existing if isinstance(existing, (int, float)) else 0
                _set_path(document, key, base + value)
        elif operator == "$addToSet":
            for key, value in payload.items():
                existing = _get_path(document, key)
                if not isinstance(existing, list):
                    existing = []
                    _set_path(document, key, existing)
                    existing = _get_path(document, key)
                candidate = _deepcopy_jsonable(value)
                if candidate not in existing:
                    existing.append(candidate)
        elif operator == "$pull":
            for key, value in payload.items():
                existing = _get_path(document, key)
                if not isinstance(existing, list):
                    continue
                if isinstance(value, dict):
                    filtered = [item for item in existing if not _matches(item if isinstance(item, dict) else {"value": item}, value)]
                else:
                    filtered = [item for item in existing if item != value]
                _set_path(document, key, filtered)


def _evaluate_expression(document: dict, expression: Any) -> Any:
    if isinstance(expression, str) and expression.startswith("$"):
        return _get_path(document, expression[1:])
    if isinstance(expression, dict) and "$cond" in expression:
        condition, if_true, if_false = expression["$cond"]
        return _evaluate_expression(document, if_true) if _evaluate_condition(document, condition) else _evaluate_expression(document, if_false)
    return expression


def _evaluate_condition(document: dict, condition: Any) -> bool:
    if isinstance(condition, dict) and "$eq" in condition:
        left, right = condition["$eq"]
        return _evaluate_expression(document, left) == _evaluate_expression(document, right)
    return bool(_evaluate_expression(document, condition))


def _group_key(document: dict, specification: Any) -> Any:
    if isinstance(specification, str):
        return _evaluate_expression(document, specification)
    if isinstance(specification, dict):
        return {key: _evaluate_expression(document, value) for key, value in specification.items()}
    return specification


class LocalCursor:
    def __init__(self, items: list[dict]):
        self._items = items

    def sort(self, field: str, direction: int):
        reverse = direction < 0
        self._items.sort(key=lambda item: _sort_key(_get_path(item, field)), reverse=reverse)
        return self

    async def to_list(self, length: int | None):
        if length is None:
            return _deepcopy_jsonable(self._items)
        return _deepcopy_jsonable(self._items[:length])


class LocalCollection:
    def __init__(self, database: "LocalAsyncDatabase", name: str):
        self._database = database
        self._name = name

    def _documents(self) -> list[dict]:
        return self._database._data.setdefault(self._name, [])

    async def find_one(self, query: dict | None = None, projection: dict | None = None):
        with self._database._lock:
            for document in self._documents():
                if _matches(document, query):
                    return _project(document, projection)
        return None

    def find(self, query: dict | None = None, projection: dict | None = None):
        with self._database._lock:
            items = [_project(document, projection) for document in self._documents() if _matches(document, query)]
        return LocalCursor(items)

    async def insert_one(self, document: dict):
        with self._database._lock:
            self._documents().append(_deepcopy_jsonable(document))
            self._database._save()
        return SimpleNamespace(inserted_id=document.get("id"))

    async def update_one(self, query: dict, update: dict, upsert: bool = False):
        with self._database._lock:
            documents = self._documents()
            for index, document in enumerate(documents):
                if _matches(document, query):
                    updated = _deepcopy_jsonable(document)
                    _apply_update(updated, update)
                    documents[index] = updated
                    self._database._save()
                    return SimpleNamespace(matched_count=1, modified_count=1, upserted_id=None)

            if upsert:
                new_document = _extract_upsert_base(query)
                _apply_update(new_document, update)
                documents.append(new_document)
                self._database._save()
                return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=new_document.get("id"))

        return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)

    async def update_many(self, query: dict, update: dict, upsert: bool = False):
        with self._database._lock:
            documents = self._documents()
            matched = 0
            for index, document in enumerate(documents):
                if _matches(document, query):
                    updated = _deepcopy_jsonable(document)
                    _apply_update(updated, update)
                    documents[index] = updated
                    matched += 1
            if matched:
                self._database._save()
                return SimpleNamespace(matched_count=matched, modified_count=matched, upserted_id=None)

            if upsert:
                new_document = _extract_upsert_base(query)
                _apply_update(new_document, update)
                documents.append(new_document)
                self._database._save()
                return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=new_document.get("id"))

        return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)

    async def delete_one(self, query: dict):
        with self._database._lock:
            documents = self._documents()
            for index, document in enumerate(documents):
                if _matches(document, query):
                    documents.pop(index)
                    self._database._save()
                    return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    async def count_documents(self, query: dict | None = None):
        with self._database._lock:
            return sum(1 for document in self._documents() if _matches(document, query))

    def aggregate(self, pipeline: list[dict]):
        with self._database._lock:
            items = [_deepcopy_jsonable(document) for document in self._documents()]

        for stage in pipeline:
            if "$match" in stage:
                items = [item for item in items if _matches(item, stage["$match"])]
            elif "$group" in stage:
                specification = stage["$group"]
                grouped = {}
                for item in items:
                    key = _group_key(item, specification["_id"])
                    key_token = json.dumps(key, sort_keys=True, default=_json_default)
                    if key_token not in grouped:
                        grouped[key_token] = {"_id": _deepcopy_jsonable(key)}
                        for field in specification:
                            if field != "_id":
                                grouped[key_token][field] = 0
                    for field, expression in specification.items():
                        if field == "_id":
                            continue
                        if isinstance(expression, dict) and "$sum" in expression:
                            amount = _evaluate_expression(item, expression["$sum"])
                            grouped[key_token][field] += amount or 0
                items = list(grouped.values())
            elif "$sort" in stage:
                sort_spec = stage["$sort"]
                for field, direction in reversed(list(sort_spec.items())):
                    items.sort(key=lambda item: _sort_key(_get_path(item, field)), reverse=direction < 0)
        return LocalCursor(items)


class LocalAsyncDatabase:
    def __init__(self, path: str | Path):
        self._path = Path(path)
        self._lock = RLock()
        self._data: dict[str, list[dict]] = {}
        self._load()

    def _load(self):
        with self._lock:
            if self._path.exists():
                try:
                    self._data = json.loads(self._path.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    self._data = {}
            else:
                self._data = {}

    def _save(self):
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(self._data, ensure_ascii=False, indent=2, default=_json_default),
            encoding="utf-8",
        )

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)
        return LocalCollection(self, name)

    async def list_collection_names(self):
        with self._lock:
            return list(self._data.keys())
