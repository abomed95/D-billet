"""
Test suite for Organizer Dashboard features:
- Dashboard KPIs (stats endpoint)
- Sales chart (7/30 days)
- Participants list with search/filter
- CSV export
- Finances summary
- Withdrawal requests
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ORGANIZER_EMAIL = "organizer@dbillet.dj"
ORGANIZER_PASSWORD = "organizer123"
ADMIN_EMAIL = "admin@dbillet.dj"
ADMIN_PASSWORD = "admin123"


class TestOrganizerAuthentication:
    """Test organizer login and auth"""
    
    def test_organizer_login(self):
        """Login as organizer"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ORGANIZER_EMAIL,
            "password": ORGANIZER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "organizer"
        print(f"✓ Organizer login successful - role: {data['user']['role']}")
        return data["access_token"]


class TestOrganizerDashboard:
    """Test Dashboard KPIs and Stats endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ORGANIZER_EMAIL,
            "password": ORGANIZER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_organizer_stats(self, auth_token):
        """GET /api/organizer/stats - Dashboard KPIs"""
        response = requests.get(f"{BASE_URL}/api/organizer/stats", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        # Verify KPI fields
        assert "total_revenue" in data
        assert "net_revenue" in data
        assert "total_tickets_sold" in data
        assert "total_tickets_available" in data
        assert "commission" in data
        
        # Verify commission is 8% of total revenue
        if data["total_revenue"] > 0:
            expected_commission = int(data["total_revenue"] * 0.08)
            assert data["commission"] == expected_commission
        
        print(f"✓ Dashboard KPIs: revenue={data['total_revenue']}, sold={data['total_tickets_sold']}, remaining={data['total_tickets_available'] - data['total_tickets_sold']}")
        return data


class TestSalesChart:
    """Test Sales Chart endpoint (7/30 days)"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ORGANIZER_EMAIL,
            "password": ORGANIZER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_sales_chart_7_days(self, auth_token):
        """GET /api/organizer/sales-chart?days=7"""
        response = requests.get(f"{BASE_URL}/api/organizer/sales-chart?days=7", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Sales chart 7 days failed: {response.text}"
        data = response.json()
        
        assert "data" in data
        assert "period" in data
        assert len(data["data"]) == 7, f"Expected 7 days, got {len(data['data'])}"
        
        # Verify data structure
        for entry in data["data"]:
            assert "date" in entry
            assert "tickets" in entry
            assert "revenue" in entry
        
        print(f"✓ Sales chart 7 days: {len(data['data'])} data points")
    
    def test_sales_chart_30_days(self, auth_token):
        """GET /api/organizer/sales-chart?days=30"""
        response = requests.get(f"{BASE_URL}/api/organizer/sales-chart?days=30", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Sales chart 30 days failed: {response.text}"
        data = response.json()
        
        assert "data" in data
        assert len(data["data"]) == 30, f"Expected 30 days, got {len(data['data'])}"
        print(f"✓ Sales chart 30 days: {len(data['data'])} data points")


class TestParticipantsList:
    """Test Participants list with search and filter"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ORGANIZER_EMAIL,
            "password": ORGANIZER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_participants_list(self, auth_token):
        """GET /api/organizer/participants"""
        response = requests.get(f"{BASE_URL}/api/organizer/participants", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Participants list failed: {response.text}"
        data = response.json()
        
        assert "participants" in data
        assert "total" in data
        
        # Verify participant structure if any exist
        if data["participants"]:
            p = data["participants"][0]
            assert "ticket_id" in p
            assert "event_title" in p
            assert "buyer_name" in p
            assert "status" in p
        
        print(f"✓ Participants list: {data['total']} total participants")
    
    def test_participants_search(self, auth_token):
        """GET /api/organizer/participants?search=test"""
        response = requests.get(f"{BASE_URL}/api/organizer/participants?search=test", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Participants search failed: {response.text}"
        data = response.json()
        assert "participants" in data
        print(f"✓ Participants search: returned {data['total']} results for 'test'")
    
    def test_participants_csv_export(self, auth_token):
        """GET /api/organizer/participants/export - CSV export"""
        response = requests.get(f"{BASE_URL}/api/organizer/participants/export", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"CSV export failed: {response.text}"
        
        # Verify CSV content type
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type, f"Expected CSV, got {content_type}"
        
        # Verify CSV has headers
        content = response.text
        assert "Nom" in content or "Email" in content, "CSV missing expected headers"
        
        print(f"✓ CSV export successful: {len(content)} bytes")


class TestOrganizerFinances:
    """Test Finances summary and withdrawals"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ORGANIZER_EMAIL,
            "password": ORGANIZER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_finances_summary(self, auth_token):
        """GET /api/organizer/finances"""
        response = requests.get(f"{BASE_URL}/api/organizer/finances", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Finances summary failed: {response.text}"
        data = response.json()
        
        # Verify KPI fields
        assert "total_revenue" in data
        assert "commission" in data
        assert "commission_rate" in data
        assert data["commission_rate"] == "8%"
        assert "net_revenue" in data
        assert "total_withdrawn" in data
        assert "pending_withdrawals" in data
        assert "available_balance" in data
        assert "withdrawals" in data
        
        # Verify balance calculation
        expected_available = data["net_revenue"] - data["total_withdrawn"] - data["pending_withdrawals"]
        assert data["available_balance"] == expected_available
        
        print(f"✓ Finances: revenue={data['total_revenue']}, commission={data['commission']}, available={data['available_balance']}")
        return data
    
    def test_withdrawal_request_dmoney(self, auth_token):
        """POST /api/organizer/withdrawals - D-Money withdrawal"""
        # First check balance
        finances_resp = requests.get(f"{BASE_URL}/api/organizer/finances", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        finances = finances_resp.json()
        
        if finances["available_balance"] < 1000:
            pytest.skip("Insufficient balance for withdrawal test")
        
        response = requests.post(f"{BASE_URL}/api/organizer/withdrawals", 
            json={
                "amount": 1000,
                "payment_method": "dmoney",
                "account_info": "+25377123456"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"D-Money withdrawal failed: {response.text}"
        data = response.json()
        
        assert "withdrawal_id" in data
        assert data["status"] == "pending"
        assert data["amount"] == 1000
        print(f"✓ D-Money withdrawal request: {data['withdrawal_id']}")
    
    def test_withdrawal_request_waafi(self, auth_token):
        """POST /api/organizer/withdrawals - Waafi withdrawal"""
        finances_resp = requests.get(f"{BASE_URL}/api/organizer/finances", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        finances = finances_resp.json()
        
        if finances["available_balance"] < 1000:
            pytest.skip("Insufficient balance for withdrawal test")
        
        response = requests.post(f"{BASE_URL}/api/organizer/withdrawals", 
            json={
                "amount": 1000,
                "payment_method": "waafi",
                "account_info": "+25377654321"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Waafi withdrawal failed: {response.text}"
        data = response.json()
        assert data["status"] == "pending"
        print(f"✓ Waafi withdrawal request: {data['withdrawal_id']}")
    
    def test_withdrawal_request_bank_transfer(self, auth_token):
        """POST /api/organizer/withdrawals - Bank transfer withdrawal"""
        finances_resp = requests.get(f"{BASE_URL}/api/organizer/finances", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        finances = finances_resp.json()
        
        if finances["available_balance"] < 1000:
            pytest.skip("Insufficient balance for withdrawal test")
        
        response = requests.post(f"{BASE_URL}/api/organizer/withdrawals", 
            json={
                "amount": 1000,
                "payment_method": "bank_transfer",
                "account_info": "IBAN DJ1234567890"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Bank transfer withdrawal failed: {response.text}"
        data = response.json()
        assert data["status"] == "pending"
        print(f"✓ Bank transfer withdrawal request: {data['withdrawal_id']}")
    
    def test_withdrawal_minimum_amount(self, auth_token):
        """POST /api/organizer/withdrawals - Test minimum 1000 DJF"""
        response = requests.post(f"{BASE_URL}/api/organizer/withdrawals", 
            json={
                "amount": 500,  # Below minimum
                "payment_method": "dmoney",
                "account_info": "+25377123456"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400, "Should reject amounts below 1000 DJF"
        print("✓ Withdrawal minimum amount validation working")


class TestOrganizerEvents:
    """Test organizer events list"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ORGANIZER_EMAIL,
            "password": ORGANIZER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_organizer_events_list(self, auth_token):
        """GET /api/organizer/events"""
        response = requests.get(f"{BASE_URL}/api/organizer/events", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Events list failed: {response.text}"
        events = response.json()
        
        # If events exist, verify structure
        if events:
            e = events[0]
            assert "id" in e
            assert "title" in e
            assert "total_tickets" in e
            assert "sold_tickets" in e
        
        print(f"✓ Organizer events: {len(events)} events")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
