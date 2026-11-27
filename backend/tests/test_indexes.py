"""
Unit tests for non-blocking index creation at startup.

Self-contained: MongoDB is replaced by a fake, no server needed. Run with:

    pytest backend/tests/test_indexes.py -v
"""
import asyncio
import os
import sys

import pytest
from pymongo.errors import ServerSelectionTimeoutError

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services import indexes  # noqa: E402

TOTAL_INDEXES = sum(len(specs) for specs in indexes._INDEX_SPEC.values())


class FakeCollection:
    def __init__(self, db):
        self.db = db

    async def create_index(self, fields, **options):
        self.db.create_calls += 1
        if self.db.fail_create_at == self.db.create_calls:
            raise ServerSelectionTimeoutError("lost")


class FakeDB:
    def __init__(self, reachable_after=0, fail_create_at=None):
        # Number of failed pings before the server answers.
        self.reachable_after = reachable_after
        self.fail_create_at = fail_create_at
        self.pings = 0
        self.create_calls = 0

    async def command(self, name):
        assert name == "ping"
        self.pings += 1
        if self.pings <= self.reachable_after:
            raise ServerSelectionTimeoutError("no server")
        return {"ok": 1}

    def __getitem__(self, _name):
        return FakeCollection(self)


@pytest.fixture()
def use_db(monkeypatch):
    def _use(fake):
        monkeypatch.setattr(indexes, "db", fake)
        monkeypatch.setattr(indexes, "DB_BACKEND", "mongo")
        return fake
    return _use


def test_unreachable_server_costs_one_probe_not_one_timeout_per_index(use_db):
    fake = use_db(FakeDB(reachable_after=99))
    assert asyncio.run(indexes.ensure_indexes()) is False
    assert fake.pings == 1
    assert fake.create_calls == 0


def test_reachable_server_creates_every_index(use_db):
    fake = use_db(FakeDB())
    assert asyncio.run(indexes.ensure_indexes()) is True
    assert fake.create_calls == TOTAL_INDEXES


def test_connection_lost_mid_run_stops_immediately(use_db):
    fake = use_db(FakeDB(fail_create_at=3))
    assert asyncio.run(indexes.ensure_indexes()) is False
    assert fake.create_calls == 3


def test_background_task_retries_until_server_answers(use_db):
    fake = use_db(FakeDB(reachable_after=2))
    assert asyncio.run(indexes.ensure_indexes_in_background(delays=(0.01, 0.01, 0.01))) is True
    assert fake.pings == 3
    assert fake.create_calls == TOTAL_INDEXES


def test_background_task_gives_up_after_last_delay(use_db):
    fake = use_db(FakeDB(reachable_after=99))
    assert asyncio.run(indexes.ensure_indexes_in_background(delays=(0.01, 0.01))) is False
    assert fake.pings == 3


def test_local_json_backend_is_skipped(monkeypatch):
    monkeypatch.setattr(indexes, "DB_BACKEND", "local-json")
    assert asyncio.run(indexes.ensure_indexes()) is True
