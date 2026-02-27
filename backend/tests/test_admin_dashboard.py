"""
Admin Dashboard Tests for D-Billet Platform
Testing: Dashboard KPIs, Alerts, Events Management, Users Management, 
Transactions, Payouts, Settings, and Transport (Train/Ferry)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@dbillet.dj"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestAdminLogin:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful - User: {data['user']['full_name']}")

    def test_admin_login_invalid_password(self):
        """Test admin login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "wrongpassword"}
        )
        assert response.status_code == 401
        print("✓ Invalid password correctly rejected")


class TestAdminDashboard:
    """Admin Dashboard KPIs and Alerts tests"""
    
    def test_admin_stats(self, admin_headers):
        """Test GET /api/admin/stats - Dashboard KPIs"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required KPI fields
        assert "total_revenue" in data
        assert "commission" in data
        assert "total_users" in data
        assert "total_organizers" in data
        assert "total_events" in data
        assert "total_tickets_sold" in data
        
        print(f"✓ Admin stats retrieved:")
        print(f"  - Total Revenue: {data['total_revenue']} DJF")
        print(f"  - Platform Commission: {data['commission']} DJF")
        print(f"  - Users: {data['total_users']}, Organizers: {data['total_organizers']}")
        print(f"  - Events: {data['total_events']}, Tickets Sold: {data['total_tickets_sold']}")

    def test_admin_alerts(self, admin_headers):
        """Test GET /api/admin/alerts - Urgent Alerts"""
        response = requests.get(
            f"{BASE_URL}/api/admin/alerts",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify alert fields
        assert "pending_events" in data
        assert "pending_withdrawals" in data
        assert "pending_withdrawals_amount" in data
        assert "pending_refunds" in data
        assert "total_alerts" in data
        
        print(f"✓ Admin alerts retrieved:")
        print(f"  - Pending Events: {data['pending_events']}")
        print(f"  - Pending Withdrawals: {data['pending_withdrawals']} ({data['pending_withdrawals_amount']} DJF)")
        print(f"  - Pending Refunds: {data['pending_refunds']}")
        print(f"  - Total Alerts: {data['total_alerts']}")


class TestAdminEventsManagement:
    """Admin Events Management tests - Approve/Block/Featured"""
    
    def test_get_all_events(self, admin_headers):
        """Test GET /api/admin/events - List all events"""
        response = requests.get(
            f"{BASE_URL}/api/admin/events",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            event = data[0]
            # Verify event structure
            assert "id" in event
            assert "title" in event
            assert "status" in event
            assert "featured" in event
            assert "total_tickets" in event
            assert "sold_tickets" in event
            assert "revenue" in event
            print(f"✓ Retrieved {len(data)} events")
            print(f"  - First event: {event['title']} (Status: {event['status']}, Featured: {event['featured']})")
        else:
            print("✓ Events list empty - no events to display")

    def test_update_event_status_approved(self, admin_headers):
        """Test PUT /api/admin/events/{id}/status - Approve event"""
        # First get an event
        response = requests.get(f"{BASE_URL}/api/admin/events", headers=admin_headers)
        events = response.json()
        
        if len(events) == 0:
            pytest.skip("No events to test status update")
        
        event_id = events[0]["id"]
        
        # Update status to approved
        response = requests.put(
            f"{BASE_URL}/api/admin/events/{event_id}/status?status=approved",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        print(f"✓ Event {event_id} approved successfully")

    def test_update_event_status_blocked(self, admin_headers):
        """Test PUT /api/admin/events/{id}/status - Block event"""
        response = requests.get(f"{BASE_URL}/api/admin/events", headers=admin_headers)
        events = response.json()
        
        if len(events) == 0:
            pytest.skip("No events to test")
        
        event_id = events[0]["id"]
        
        # Block the event
        response = requests.put(
            f"{BASE_URL}/api/admin/events/{event_id}/status?status=blocked",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "blocked"
        print(f"✓ Event {event_id} blocked successfully")
        
        # Restore to approved
        requests.put(
            f"{BASE_URL}/api/admin/events/{event_id}/status?status=approved",
            headers=admin_headers
        )

    def test_toggle_event_featured(self, admin_headers):
        """Test PUT /api/admin/events/{id}/featured - Set À la une"""
        response = requests.get(f"{BASE_URL}/api/admin/events", headers=admin_headers)
        events = response.json()
        
        if len(events) == 0:
            pytest.skip("No events to test featured toggle")
        
        event_id = events[0]["id"]
        
        # Set as featured
        response = requests.put(
            f"{BASE_URL}/api/admin/events/{event_id}/featured?featured=true",
            headers=admin_headers
        )
        assert response.status_code == 200
        print(f"✓ Event {event_id} set as featured (À la une)")
        
        # Verify change
        response = requests.get(f"{BASE_URL}/api/admin/events", headers=admin_headers)
        events = response.json()
        event = next((e for e in events if e["id"] == event_id), None)
        assert event["featured"] == True
        print(f"✓ Featured status verified")

    def test_invalid_event_status(self, admin_headers):
        """Test PUT /api/admin/events/{id}/status - Invalid status"""
        response = requests.get(f"{BASE_URL}/api/admin/events", headers=admin_headers)
        events = response.json()
        
        if len(events) == 0:
            pytest.skip("No events to test")
        
        event_id = events[0]["id"]
        
        # Try invalid status
        response = requests.put(
            f"{BASE_URL}/api/admin/events/{event_id}/status?status=invalid_status",
            headers=admin_headers
        )
        assert response.status_code == 422  # Validation error
        print("✓ Invalid status correctly rejected")


class TestAdminUsersManagement:
    """Admin Users Management tests - List/Filter/Commission"""
    
    def test_get_all_users(self, admin_headers):
        """Test GET /api/admin/users - List all users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "full_name" in user
            assert "role" in user
            print(f"✓ Retrieved {len(data)} users")
        else:
            print("✓ Users list empty")

    def test_get_users_filter_organizers(self, admin_headers):
        """Test GET /api/admin/users?role=organizer - Filter organizers"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?role=organizer",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all are organizers
        for user in data:
            assert user["role"] == "organizer"
        print(f"✓ Retrieved {len(data)} organizers")

    def test_get_users_filter_clients(self, admin_headers):
        """Test GET /api/admin/users?role=user - Filter clients"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?role=user",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all are users/clients
        for user in data:
            assert user["role"] == "user"
        print(f"✓ Retrieved {len(data)} clients")

    def test_get_user_detail(self, admin_headers):
        """Test GET /api/admin/users/{id} - User detail"""
        # Get user list first
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        users = response.json()
        
        if len(users) == 0:
            pytest.skip("No users to test detail")
        
        user_id = users[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == user_id
        assert "purchase_history" in data
        print(f"✓ User detail retrieved: {data['full_name']}")

    def test_set_custom_commission(self, admin_headers):
        """Test PUT /api/admin/users/{id}/commission - Set custom commission"""
        # Find an organizer
        response = requests.get(
            f"{BASE_URL}/api/admin/users?role=organizer",
            headers=admin_headers
        )
        organizers = response.json()
        
        if len(organizers) == 0:
            pytest.skip("No organizers to test commission")
        
        organizer_id = organizers[0]["id"]
        
        # Set custom commission to 5%
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{organizer_id}/commission?commission_rate=5",
            headers=admin_headers
        )
        assert response.status_code == 200
        print(f"✓ Custom commission set to 5% for organizer")
        
        # Verify change
        response = requests.get(
            f"{BASE_URL}/api/admin/users/{organizer_id}",
            headers=admin_headers
        )
        data = response.json()
        assert data.get("custom_commission") == 5.0
        print(f"✓ Commission verified: {data.get('custom_commission')}%")

    def test_set_commission_invalid_user(self, admin_headers):
        """Test commission on non-organizer - should fail"""
        # Find a regular user
        response = requests.get(
            f"{BASE_URL}/api/admin/users?role=user",
            headers=admin_headers
        )
        users = response.json()
        
        if len(users) == 0:
            pytest.skip("No regular users to test")
        
        user_id = users[0]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{user_id}/commission?commission_rate=5",
            headers=admin_headers
        )
        assert response.status_code == 400
        print("✓ Commission on non-organizer correctly rejected")


class TestAdminTransactions:
    """Admin Transactions tests"""
    
    def test_get_transactions(self, admin_headers):
        """Test GET /api/admin/transactions - List transactions"""
        response = requests.get(
            f"{BASE_URL}/api/admin/transactions",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "transactions" in data
        assert "totals_by_method" in data
        assert "total_count" in data
        assert "total_amount" in data
        
        print(f"✓ Transactions retrieved:")
        print(f"  - Total: {data['total_count']} transactions")
        print(f"  - Amount: {data['total_amount']} DJF")

    def test_get_transactions_filter_payment_method(self, admin_headers):
        """Test GET /api/admin/transactions?payment_method=waafi"""
        response = requests.get(
            f"{BASE_URL}/api/admin/transactions?payment_method=waafi",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all transactions are waafi
        for t in data["transactions"]:
            assert t["payment_method"] == "waafi"
        print(f"✓ Filtered {len(data['transactions'])} Waafi transactions")

    def test_get_transactions_filter_days(self, admin_headers):
        """Test GET /api/admin/transactions?days=7 - Last 7 days"""
        response = requests.get(
            f"{BASE_URL}/api/admin/transactions?days=7",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Retrieved {data['total_count']} transactions from last 7 days")


class TestAdminPayouts:
    """Admin Payouts (Withdrawal Management) tests"""
    
    def test_get_payouts(self, admin_headers):
        """Test GET /api/admin/payouts - List all withdrawal requests"""
        response = requests.get(
            f"{BASE_URL}/api/admin/payouts",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✓ Retrieved {len(data)} payout requests")
        
        if len(data) > 0:
            payout = data[0]
            assert "id" in payout
            assert "amount" in payout
            assert "status" in payout
            assert "payment_method" in payout
            print(f"  - First payout: {payout['amount']} DJF ({payout['status']})")

    def test_get_payouts_filter_pending(self, admin_headers):
        """Test GET /api/admin/payouts?status=pending"""
        response = requests.get(
            f"{BASE_URL}/api/admin/payouts?status=pending",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        for payout in data:
            assert payout["status"] == "pending"
        print(f"✓ Retrieved {len(data)} pending payouts")

    def test_update_payout_status_completed(self, admin_headers):
        """Test PUT /api/admin/payouts/{id}/status - Validate payout"""
        # Get pending payouts
        response = requests.get(
            f"{BASE_URL}/api/admin/payouts?status=pending",
            headers=admin_headers
        )
        payouts = response.json()
        
        if len(payouts) == 0:
            pytest.skip("No pending payouts to test")
        
        payout_id = payouts[0]["id"]
        
        # Validate payout
        response = requests.put(
            f"{BASE_URL}/api/admin/payouts/{payout_id}/status?status=completed&notes=Test%20validation",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "completed" in data["message"].lower() or "status" in data
        print(f"✓ Payout {payout_id} validated successfully")

    def test_update_payout_status_rejected(self, admin_headers):
        """Test PUT /api/admin/payouts/{id}/status - Reject payout"""
        response = requests.get(
            f"{BASE_URL}/api/admin/payouts?status=pending",
            headers=admin_headers
        )
        payouts = response.json()
        
        if len(payouts) == 0:
            pytest.skip("No pending payouts to test rejection")
        
        payout_id = payouts[0]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/payouts/{payout_id}/status?status=rejected&notes=Test%20rejection",
            headers=admin_headers
        )
        assert response.status_code == 200
        print(f"✓ Payout {payout_id} rejected successfully")


class TestAdminSettings:
    """Admin Settings tests - Commission, Categories, CGU, Banner"""
    
    def test_get_settings(self, admin_headers):
        """Test GET /api/admin/settings - Get platform settings"""
        response = requests.get(
            f"{BASE_URL}/api/admin/settings",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify settings structure
        assert "commission_rate" in data
        assert "min_withdrawal" in data
        assert "categories" in data
        
        print(f"✓ Settings retrieved:")
        print(f"  - Commission Rate: {data['commission_rate']}%")
        print(f"  - Min Withdrawal: {data['min_withdrawal']} DJF")
        print(f"  - Categories: {len(data.get('categories', []))}")

    def test_update_commission_rate(self, admin_headers):
        """Test PUT /api/admin/settings - Update commission rate"""
        response = requests.put(
            f"{BASE_URL}/api/admin/settings?commission_rate=10",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["commission_rate"] == 10.0
        print("✓ Commission rate updated to 10%")
        
        # Restore to 8%
        requests.put(
            f"{BASE_URL}/api/admin/settings?commission_rate=8",
            headers=admin_headers
        )
        print("✓ Commission rate restored to 8%")

    def test_update_min_withdrawal(self, admin_headers):
        """Test PUT /api/admin/settings - Update min withdrawal"""
        response = requests.put(
            f"{BASE_URL}/api/admin/settings?min_withdrawal=2000",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["min_withdrawal"] == 2000
        print("✓ Min withdrawal updated to 2000 DJF")
        
        # Restore to 1000
        requests.put(
            f"{BASE_URL}/api/admin/settings?min_withdrawal=1000",
            headers=admin_headers
        )

    def test_add_category(self, admin_headers):
        """Test POST /api/admin/settings/categories - Add category"""
        response = requests.post(
            f"{BASE_URL}/api/admin/settings/categories?name=Test%20Category&color=%23FF0000",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        print(f"✓ Category added: {data['id']}")
        
        # Verify category was added
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers)
        settings = response.json()
        cat_names = [c["name"] for c in settings.get("categories", [])]
        assert "Test Category" in cat_names

    def test_delete_category(self, admin_headers):
        """Test DELETE /api/admin/settings/categories/{id} - Delete category"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/settings/categories/test_category",
            headers=admin_headers
        )
        assert response.status_code == 200
        print("✓ Category deleted")

    def test_update_banner(self, admin_headers):
        """Test PUT /api/admin/settings - Update banner"""
        response = requests.put(
            f"{BASE_URL}/api/admin/settings?banner_text=Test%20Banner%20Message&banner_active=true",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["banner_text"] == "Test Banner Message"
        assert data["banner_active"] == True
        print("✓ Banner updated and activated")
        
        # Deactivate banner
        requests.put(
            f"{BASE_URL}/api/admin/settings?banner_active=false",
            headers=admin_headers
        )


class TestAdminTransport:
    """Admin Transport Settings tests - Train & Ferry"""
    
    def test_get_transport_settings(self, admin_headers):
        """Test GET /api/admin/transport/settings"""
        response = requests.get(
            f"{BASE_URL}/api/admin/transport/settings",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "train" in data
        assert "ferry" in data
        
        # Train settings
        assert "active" in data["train"]
        assert "routes" in data["train"]
        assert "departure_time" in data["train"]
        
        # Ferry settings
        assert "active" in data["ferry"]
        assert "routes" in data["ferry"]
        assert "departure_time" in data["ferry"]
        
        print(f"✓ Transport settings retrieved:")
        print(f"  - Train: {'Active' if data['train']['active'] else 'Inactive'}")
        print(f"  - Ferry: {'Active' if data['ferry']['active'] else 'Inactive'}")

    def test_update_train_settings(self, admin_headers):
        """Test PUT /api/admin/transport/train - Update train settings"""
        response = requests.put(
            f"{BASE_URL}/api/admin/transport/train?active=true&departure_time=07:00",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["train"]["active"] == True
        assert data["train"]["departure_time"] == "07:00"
        print("✓ Train settings updated")
        
        # Restore departure time
        requests.put(
            f"{BASE_URL}/api/admin/transport/train?departure_time=06:00",
            headers=admin_headers
        )

    def test_toggle_train_service(self, admin_headers):
        """Test PUT /api/admin/transport/train - Toggle train service"""
        # Deactivate
        response = requests.put(
            f"{BASE_URL}/api/admin/transport/train?active=false",
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["train"]["active"] == False
        print("✓ Train service deactivated")
        
        # Reactivate
        response = requests.put(
            f"{BASE_URL}/api/admin/transport/train?active=true",
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["train"]["active"] == True
        print("✓ Train service reactivated")

    def test_update_ferry_settings(self, admin_headers):
        """Test PUT /api/admin/transport/ferry - Update ferry settings"""
        response = requests.put(
            f"{BASE_URL}/api/admin/transport/ferry?active=true&departure_time=09:00&return_time=13:00",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ferry"]["active"] == True
        assert data["ferry"]["departure_time"] == "09:00"
        assert data["ferry"]["return_time"] == "13:00"
        print("✓ Ferry settings updated")
        
        # Restore times
        requests.put(
            f"{BASE_URL}/api/admin/transport/ferry?departure_time=08:00&return_time=12:00",
            headers=admin_headers
        )

    def test_toggle_ferry_service(self, admin_headers):
        """Test PUT /api/admin/transport/ferry - Toggle ferry service"""
        # Deactivate
        response = requests.put(
            f"{BASE_URL}/api/admin/transport/ferry?active=false",
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["ferry"]["active"] == False
        print("✓ Ferry service deactivated")
        
        # Reactivate
        response = requests.put(
            f"{BASE_URL}/api/admin/transport/ferry?active=true",
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["ferry"]["active"] == True
        print("✓ Ferry service reactivated")


class TestAdminAuthorization:
    """Test that admin-only endpoints reject non-admin users"""
    
    def test_non_admin_access_denied(self):
        """Test that non-admin users cannot access admin endpoints"""
        # Try without auth
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 403 or response.status_code == 401
        print("✓ Unauthenticated access correctly denied")
        
    def test_organizer_cannot_access_admin(self):
        """Test that organizers cannot access admin endpoints"""
        # Login as organizer
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "organizer@dbillet.dj", "password": "organizer123"}
        )
        
        if login_response.status_code != 200:
            pytest.skip("Organizer login failed")
        
        organizer_token = login_response.json()["access_token"]
        organizer_headers = {"Authorization": f"Bearer {organizer_token}"}
        
        # Try accessing admin stats
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers=organizer_headers
        )
        assert response.status_code == 403
        print("✓ Organizer correctly denied admin access")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
