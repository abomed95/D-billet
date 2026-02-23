"""
Test suite for D-Billet Platform - Payment Logos, Train/Ferry Booking and PDF Features
Tests cover: 
- Train trips API (even/odd day logic, holidays)
- Ferry trips API (weekday-based routing)
- Train booking API
- Ferry booking API
- Ticket PDF download
- Ticket view with QR code and WhatsApp share URL
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Health check and basic connectivity"""
    
    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200, f"Events API failed: {response.text}"
        print(f"✓ Events API working - {len(response.json())} events found")


class TestTrainAPI:
    """Train trips and booking tests"""
    
    def test_train_trips_even_day(self):
        """Even day = departures from Nagad towards East"""
        # Find an even day that's not 1st of month
        test_date = None
        for days_ahead in range(0, 30):
            check_date = datetime.now() + timedelta(days=days_ahead)
            if check_date.day % 2 == 0 and check_date.day != 1:
                test_date = check_date.strftime("%Y-%m-%d")
                break
        
        if not test_date:
            pytest.skip("No even day found in next 30 days")
        
        response = requests.get(f"{BASE_URL}/api/train/trips?date={test_date}")
        assert response.status_code == 200, f"Train trips API failed: {response.text}"
        
        data = response.json()
        assert data["is_holiday"] == False
        assert data["is_even_day"] == True
        assert "Nagad" in data["direction"]
        assert len(data["trips"]) > 0
        
        # Check trip structure
        trip = data["trips"][0]
        assert "departure" in trip
        assert "arrival" in trip
        assert "price" in trip
        assert "departure_time" in trip
        print(f"✓ Train trips (even day {test_date}): {len(data['trips'])} trips found")
    
    def test_train_trips_odd_day(self):
        """Odd day = departures from Ali-Sabieh towards West"""
        test_date = None
        for days_ahead in range(0, 30):
            check_date = datetime.now() + timedelta(days=days_ahead)
            if check_date.day % 2 != 0 and check_date.day != 1:
                test_date = check_date.strftime("%Y-%m-%d")
                break
        
        if not test_date:
            pytest.skip("No odd day found in next 30 days")
        
        response = requests.get(f"{BASE_URL}/api/train/trips?date={test_date}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_holiday"] == False
        assert data["is_even_day"] == False
        assert "Ali-Sabieh" in data["direction"]
        print(f"✓ Train trips (odd day {test_date}): {len(data['trips'])} trips found")
    
    def test_train_trips_holiday(self):
        """1st of any month = holiday, no service"""
        # Find next 1st of month
        current = datetime.now()
        if current.day == 1:
            test_date = current.strftime("%Y-%m-%d")
        else:
            if current.month == 12:
                test_date = f"{current.year + 1}-01-01"
            else:
                test_date = f"{current.year}-{current.month + 1:02d}-01"
        
        response = requests.get(f"{BASE_URL}/api/train/trips?date={test_date}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_holiday"] == True
        assert len(data["trips"]) == 0
        print(f"✓ Train trips (holiday {test_date}): No service as expected")


class TestFerryAPI:
    """Ferry trips and booking tests"""
    
    def test_ferry_trips_tadjoura_route(self):
        """Tue/Thu/Fri/Sat = Djibouti-Tadjoura route"""
        # Find a Tuesday, Thursday, Friday or Saturday
        test_date = None
        for days_ahead in range(0, 14):
            check_date = datetime.now() + timedelta(days=days_ahead)
            if check_date.weekday() in [1, 3, 4, 5]:  # Tue, Thu, Fri, Sat
                test_date = check_date.strftime("%Y-%m-%d")
                break
        
        if not test_date:
            pytest.skip("No Tadjoura route day found")
        
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={test_date}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["has_service"] == True
        assert "Tadjoura" in data["route"]
        assert len(data["trips"]) == 2  # aller + retour
        
        # Check price is 700 DJF
        for trip in data["trips"]:
            assert trip["price"] == 700
        print(f"✓ Ferry trips (Tadjoura {test_date}): {len(data['trips'])} trips, 700 DJF each")
    
    def test_ferry_trips_obock_route(self):
        """Sun/Wed = Djibouti-Obock route"""
        test_date = None
        for days_ahead in range(0, 14):
            check_date = datetime.now() + timedelta(days=days_ahead)
            if check_date.weekday() in [2, 6]:  # Wed, Sun
                test_date = check_date.strftime("%Y-%m-%d")
                break
        
        if not test_date:
            pytest.skip("No Obock route day found")
        
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={test_date}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["has_service"] == True
        assert "Obock" in data["route"]
        print(f"✓ Ferry trips (Obock {test_date}): {len(data['trips'])} trips available")
    
    def test_ferry_trips_no_service_monday(self):
        """Monday = no service"""
        test_date = None
        for days_ahead in range(0, 14):
            check_date = datetime.now() + timedelta(days=days_ahead)
            if check_date.weekday() == 0:  # Monday
                test_date = check_date.strftime("%Y-%m-%d")
                break
        
        if not test_date:
            pytest.skip("No Monday found")
        
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={test_date}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["has_service"] == False
        assert len(data["trips"]) == 0
        print(f"✓ Ferry trips (Monday {test_date}): No service as expected")


class TestAuthAndBooking:
    """Authentication and booking tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for organizer user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "organizer@dbillet.dj",
            "password": "organizer123"
        })
        if response.status_code != 200:
            pytest.skip("Organizer login failed - database may not be seeded")
        return response.json()["access_token"]
    
    def test_organizer_login(self, auth_token):
        """Test organizer can log in"""
        assert auth_token is not None
        assert len(auth_token) > 10
        print("✓ Organizer login successful")
    
    def test_train_booking(self, auth_token):
        """Test train booking creates tickets"""
        # Find a valid train day (even or odd, not 1st)
        test_date = None
        for days_ahead in range(1, 30):
            check_date = datetime.now() + timedelta(days=days_ahead)
            if check_date.day != 1:
                test_date = check_date.strftime("%Y-%m-%d")
                break
        
        # Get available trips
        trips_response = requests.get(f"{BASE_URL}/api/train/trips?date={test_date}")
        trips_data = trips_response.json()
        
        if trips_data.get("is_holiday") or len(trips_data.get("trips", [])) == 0:
            pytest.skip("No train trips available for test date")
        
        trip = trips_data["trips"][0]
        
        # Book train
        booking_response = requests.post(
            f"{BASE_URL}/api/train/book",
            json={
                "date": test_date,
                "departure": trip["departure"],
                "arrival": trip["arrival"],
                "passengers": [
                    {"full_name": "TEST_Train_Passenger", "phone": "+25377000099", "passport_or_cni": "TEST123"}
                ],
                "payment_method": "waafi"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert booking_response.status_code == 200, f"Train booking failed: {booking_response.text}"
        data = booking_response.json()
        assert "tickets" in data
        assert len(data["tickets"]) == 1
        assert data["total"] == trip["price"]
        
        ticket_id = data["tickets"][0]["id"]
        print(f"✓ Train booking successful - Ticket ID: {ticket_id[:8]}...")
        return ticket_id
    
    def test_ferry_booking(self, auth_token):
        """Test ferry booking creates tickets"""
        # Find a valid ferry day (not Monday)
        test_date = None
        for days_ahead in range(1, 14):
            check_date = datetime.now() + timedelta(days=days_ahead)
            if check_date.weekday() != 0:  # Not Monday
                test_date = check_date.strftime("%Y-%m-%d")
                break
        
        # Get available trips
        trips_response = requests.get(f"{BASE_URL}/api/ferry/trips?date={test_date}")
        trips_data = trips_response.json()
        
        if not trips_data.get("has_service") or len(trips_data.get("trips", [])) == 0:
            pytest.skip("No ferry trips available for test date")
        
        trip = trips_data["trips"][0]
        
        # Book ferry
        booking_response = requests.post(
            f"{BASE_URL}/api/ferry/book",
            json={
                "date": test_date,
                "departure": trip["departure"],
                "arrival": trip["arrival"],
                "trip_type": trip["trip_type"],
                "passengers": [
                    {"full_name": "TEST_Ferry_Passenger", "phone": "+25377000098", "passport_or_cni": "TESTFERRY123"}
                ],
                "payment_method": "dmoney"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert booking_response.status_code == 200, f"Ferry booking failed: {booking_response.text}"
        data = booking_response.json()
        assert "tickets" in data
        assert len(data["tickets"]) == 1
        assert data["total"] == 700  # Fixed ferry price
        
        ticket_id = data["tickets"][0]["id"]
        print(f"✓ Ferry booking successful - Ticket ID: {ticket_id[:8]}...")
        return ticket_id


class TestTicketViewAndPDF:
    """Test ticket view with QR code and PDF download"""
    
    @pytest.fixture
    def auth_token_and_ticket(self):
        """Login and create a ticket for testing"""
        # Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "organizer@dbillet.dj",
            "password": "organizer123"
        })
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        token = login_response.json()["access_token"]
        
        # Find valid train date and book
        test_date = None
        for days_ahead in range(1, 30):
            check_date = datetime.now() + timedelta(days=days_ahead)
            if check_date.day != 1:
                test_date = check_date.strftime("%Y-%m-%d")
                break
        
        trips_response = requests.get(f"{BASE_URL}/api/train/trips?date={test_date}")
        trips_data = trips_response.json()
        
        if trips_data.get("is_holiday") or len(trips_data.get("trips", [])) == 0:
            pytest.skip("No train trips available")
        
        trip = trips_data["trips"][0]
        
        booking_response = requests.post(
            f"{BASE_URL}/api/train/book",
            json={
                "date": test_date,
                "departure": trip["departure"],
                "arrival": trip["arrival"],
                "passengers": [
                    {"full_name": "TEST_PDF_Passenger", "phone": "+25377000097", "passport_or_cni": "TESTPDF123"}
                ],
                "payment_method": "cacbank"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if booking_response.status_code != 200:
            pytest.skip("Booking failed")
        
        ticket_id = booking_response.json()["tickets"][0]["id"]
        return token, ticket_id
    
    def test_ticket_view_with_qr_and_whatsapp(self, auth_token_and_ticket):
        """Test ticket view returns QR code image and WhatsApp share URL"""
        token, ticket_id = auth_token_and_ticket
        
        response = requests.get(f"{BASE_URL}/api/tickets/{ticket_id}/view")
        assert response.status_code == 200, f"Ticket view failed: {response.text}"
        
        data = response.json()
        
        # Check ticket data structure
        assert "id" in data
        assert "event_title" in data
        assert "event_date" in data
        assert "event_time" in data
        assert "event_venue" in data
        assert "qr_code_data" in data
        assert "price" in data
        
        # Check QR code image is generated (base64)
        assert "qr_code_image" in data
        assert data["qr_code_image"].startswith("data:image/png;base64,")
        
        # Check WhatsApp share URL
        assert "whatsapp_url" in data
        assert "wa.me" in data["whatsapp_url"]
        
        # Check share URL
        assert "share_url" in data
        
        print(f"✓ Ticket view - QR code generated, WhatsApp URL present")
        print(f"  QR data: {data['qr_code_data']}")
        print(f"  WhatsApp URL prefix: {data['whatsapp_url'][:50]}...")
    
    def test_ticket_pdf_download(self, auth_token_and_ticket):
        """Test PDF download returns valid PDF file"""
        token, ticket_id = auth_token_and_ticket
        
        response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}/pdf",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"PDF download failed: {response.text}"
        assert response.headers.get("content-type") == "application/pdf"
        
        # Check PDF file starts with %PDF
        content = response.content
        assert content[:4] == b'%PDF', "Response is not a valid PDF"
        
        # Check filename in content-disposition
        content_disposition = response.headers.get("content-disposition", "")
        assert "filename=" in content_disposition
        assert "billet-" in content_disposition
        
        print(f"✓ PDF download successful - {len(content)} bytes")
        print(f"  Content-Disposition: {content_disposition}")


class TestPaymentMethods:
    """Test that payment methods are accepted (MOCKED/SIMULATED)"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "organizer@dbillet.dj",
            "password": "organizer123"
        })
        if response.status_code != 200:
            pytest.skip("Login failed")
        return response.json()["access_token"]
    
    def test_waafi_payment_method(self, auth_token):
        """Test booking with Waafi payment (SIMULATED)"""
        self._test_payment_method(auth_token, "waafi")
    
    def test_dmoney_payment_method(self, auth_token):
        """Test booking with D-Money payment (SIMULATED)"""
        self._test_payment_method(auth_token, "dmoney")
    
    def test_cacbank_payment_method(self, auth_token):
        """Test booking with CAC Bank payment (SIMULATED)"""
        self._test_payment_method(auth_token, "cacbank")
    
    def _test_payment_method(self, token, payment_method):
        """Helper to test a specific payment method"""
        # Find valid ferry date
        test_date = None
        for days_ahead in range(1, 14):
            check_date = datetime.now() + timedelta(days=days_ahead)
            if check_date.weekday() != 0:
                test_date = check_date.strftime("%Y-%m-%d")
                break
        
        trips_response = requests.get(f"{BASE_URL}/api/ferry/trips?date={test_date}")
        if trips_response.status_code != 200:
            pytest.skip("Could not get ferry trips")
        
        trips_data = trips_response.json()
        if not trips_data.get("has_service"):
            pytest.skip("No ferry service available")
        
        trip = trips_data["trips"][0]
        
        booking_response = requests.post(
            f"{BASE_URL}/api/ferry/book",
            json={
                "date": test_date,
                "departure": trip["departure"],
                "arrival": trip["arrival"],
                "trip_type": trip["trip_type"],
                "passengers": [
                    {"full_name": f"TEST_{payment_method}_Passenger", "phone": "+25377000096", "passport_or_cni": f"TEST{payment_method.upper()}"}
                ],
                "payment_method": payment_method
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert booking_response.status_code == 200, f"{payment_method} payment failed: {booking_response.text}"
        print(f"✓ {payment_method.upper()} payment accepted (SIMULATED)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
