#!/usr/bin/env python3
"""
D-Billet Backend API Testing Suite
Tests all endpoints for the ticketing platform
"""

import requests
import sys
import json
from datetime import datetime
import uuid
import os

class DBilletAPITester:
    def __init__(self, base_url=None):
        if base_url is None:
            backend_base = (
                os.environ.get("TEST_BACKEND_URL")
                or os.environ.get("REACT_APP_BACKEND_URL")
                or "http://127.0.0.1:8001"
            ).rstrip("/")
            base_url = f"{backend_base}/api"
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.test_user_id = None
        self.test_event_id = None
        self.test_ticket_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log(self, message, status="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {status}: {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        self.log(f"Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}", "PASS")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "FAIL")
                self.log(f"Response: {response.text[:200]}", "ERROR")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}", "ERROR")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_database_seeding(self):
        """Test database seeding"""
        self.log("=== Testing Database Seeding ===")
        success, response = self.run_test(
            "Seed Database",
            "POST",
            "seed",
            200
        )
        return success

    def test_authentication(self):
        """Test authentication endpoints"""
        self.log("=== Testing Authentication ===")
        
        # Test user registration
        test_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "name": "Test User",
                "email": test_email,
                "password": "testpass123"
            }
        )
        
        if success and 'access_token' in response:
            self.user_token = response['access_token']
            self.test_user_id = response['user']['id']
            self.log(f"User token obtained: {self.user_token[:20]}...")
        
        # Test user login
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": test_email,
                "password": "testpass123"
            }
        )
        
        # Test admin login
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": "admin@dbillet.dj",
                "password": "admin123"
            }
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.log(f"Admin token obtained: {self.admin_token[:20]}...")
        
        # Test get current user
        if self.user_token:
            success, response = self.run_test(
                "Get Current User",
                "GET",
                "auth/me",
                200,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {self.user_token}'
                }
            )

    def test_events(self):
        """Test events endpoints"""
        self.log("=== Testing Events ===")
        
        # Test get all events
        success, response = self.run_test(
            "Get All Events",
            "GET",
            "events",
            200
        )
        
        if success and response and len(response) > 0:
            self.test_event_id = response[0]['id']
            self.log(f"Test event ID: {self.test_event_id}")
        
        # Test get events by category
        success, response = self.run_test(
            "Get Events by Category",
            "GET",
            "events",
            200,
            params={"category": "cinema"}
        )
        
        # Test get featured events
        success, response = self.run_test(
            "Get Featured Events",
            "GET",
            "events",
            200,
            params={"featured": True}
        )
        
        # Test get single event
        if self.test_event_id:
            success, response = self.run_test(
                "Get Single Event",
                "GET",
                f"events/{self.test_event_id}",
                200
            )

    def test_admin_events(self):
        """Test admin event management"""
        self.log("=== Testing Admin Event Management ===")
        
        if not self.admin_token:
            self.log("❌ No admin token available, skipping admin tests", "ERROR")
            return
        
        admin_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.admin_token}'
        }
        
        # Test create event
        new_event_data = {
            "title": "Test Event",
            "description": "A test event for API testing",
            "category": "cinema",
            "image_url": "https://images.unsplash.com/photo-1672862313692-3346b57e3fa2",
            "price": 1000,
            "total_tickets": 50,
            "venue": "Test Venue",
            "date": "2025-02-01",
            "time": "20:00"
        }
        
        success, response = self.run_test(
            "Create Event (Admin)",
            "POST",
            "events",
            200,
            data=new_event_data,
            headers=admin_headers
        )
        
        created_event_id = None
        if success and 'id' in response:
            created_event_id = response['id']
        
        # Test update event
        if created_event_id:
            success, response = self.run_test(
                "Update Event (Admin)",
                "PUT",
                f"events/{created_event_id}",
                200,
                data={"title": "Updated Test Event"},
                headers=admin_headers
            )
        
        # Test delete event
        if created_event_id:
            success, response = self.run_test(
                "Delete Event (Admin)",
                "DELETE",
                f"events/{created_event_id}",
                200,
                headers=admin_headers
            )

    def test_cart_operations(self):
        """Test cart operations"""
        self.log("=== Testing Cart Operations ===")
        
        if not self.user_token or not self.test_event_id:
            self.log("❌ No user token or event ID available, skipping cart tests", "ERROR")
            return
        
        user_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.user_token}'
        }
        
        # Test get empty cart
        success, response = self.run_test(
            "Get Empty Cart",
            "GET",
            "cart",
            200,
            headers=user_headers
        )
        
        # Test add to cart
        success, response = self.run_test(
            "Add to Cart",
            "POST",
            "cart/add",
            200,
            data={
                "event_id": self.test_event_id,
                "quantity": 2
            },
            headers=user_headers
        )
        
        # Test get cart with items
        success, response = self.run_test(
            "Get Cart with Items",
            "GET",
            "cart",
            200,
            headers=user_headers
        )
        
        # Test remove from cart
        success, response = self.run_test(
            "Remove from Cart",
            "DELETE",
            f"cart/{self.test_event_id}",
            200,
            headers=user_headers
        )

    def test_checkout_process(self):
        """Test checkout and payment process"""
        self.log("=== Testing Checkout Process ===")
        
        if not self.user_token or not self.test_event_id:
            self.log("❌ No user token or event ID available, skipping checkout tests", "ERROR")
            return
        
        user_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.user_token}'
        }
        
        # Add item to cart first
        success, response = self.run_test(
            "Add Item for Checkout",
            "POST",
            "cart/add",
            200,
            data={
                "event_id": self.test_event_id,
                "quantity": 1
            },
            headers=user_headers
        )
        
        # Test checkout
        success, response = self.run_test(
            "Checkout Process",
            "POST",
            "checkout",
            200,
            data={
                "payment_method": "waafi",
                "phone_number": "+253 77 12 34 56"
            },
            headers=user_headers
        )
        
        if success and 'ticket_ids' in response and len(response['ticket_ids']) > 0:
            self.test_ticket_id = response['ticket_ids'][0]
            self.log(f"Test ticket ID: {self.test_ticket_id}")

    def test_tickets(self):
        """Test ticket operations"""
        self.log("=== Testing Ticket Operations ===")
        
        if not self.user_token:
            self.log("❌ No user token available, skipping ticket tests", "ERROR")
            return
        
        user_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.user_token}'
        }
        
        # Test get user tickets
        success, response = self.run_test(
            "Get User Tickets",
            "GET",
            "tickets",
            200,
            headers=user_headers
        )
        
        # Test get specific ticket
        if self.test_ticket_id:
            success, response = self.run_test(
                "Get Specific Ticket",
                "GET",
                f"tickets/{self.test_ticket_id}",
                200,
                headers=user_headers
            )

    def test_admin_dashboard(self):
        """Test admin dashboard"""
        self.log("=== Testing Admin Dashboard ===")
        
        if not self.admin_token:
            self.log("❌ No admin token available, skipping admin dashboard tests", "ERROR")
            return
        
        admin_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.admin_token}'
        }
        
        # Test dashboard stats
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "admin/dashboard",
            200,
            headers=admin_headers
        )
        
        # Test get all tickets (admin)
        success, response = self.run_test(
            "Get All Tickets (Admin)",
            "GET",
            "admin/tickets",
            200,
            headers=admin_headers
        )

    def test_admin_scanner(self):
        """Test admin ticket scanner"""
        self.log("=== Testing Admin Scanner ===")
        
        if not self.admin_token or not self.test_ticket_id:
            self.log("❌ No admin token or ticket ID available, skipping scanner tests", "ERROR")
            return
        
        admin_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.admin_token}'
        }
        
        # Test scan ticket
        success, response = self.run_test(
            "Scan Ticket",
            "POST",
            f"admin/scan?ticket_id={self.test_ticket_id}",
            200,
            headers=admin_headers
        )
        
        # Test scan already used ticket (should fail)
        success, response = self.run_test(
            "Scan Used Ticket",
            "POST",
            f"admin/scan?ticket_id={self.test_ticket_id}",
            400,
            headers=admin_headers
        )

    def test_train_booking(self):
        """Test train booking functionality"""
        self.log("=== Testing Train Booking ===")
        
        if not self.user_token:
            self.log("❌ No user token available, skipping train booking tests", "ERROR")
            return
        
        user_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.user_token}'
        }
        
        # Test train booking for even day (from Nagad)
        even_date = "2025-01-20"  # Even day (20th)
        success, response = self.run_test(
            "Train Booking - Even Day (Nagad)",
            "POST",
            "train/book",
            200,
            data={
                "route": {
                    "from": "Nagad",
                    "to": "Holl-Holl", 
                    "price": 400
                },
                "date": even_date,
                "passenger": {
                    "fullName": "Test Passenger",
                    "phone": "+253 77 12 34 56",
                    "passportId": "DJ123456",
                    "nationalId": "CNI789",
                    "dateOfBirth": "1990-01-01",
                    "gender": "male",
                    "citizenship": "Djiboutien"
                },
                "payment_method": "waafi"
            },
            headers=user_headers
        )
        
        # Test train booking for odd day (from Ali-Sabieh)
        odd_date = "2025-01-21"  # Odd day (21st)
        success, response = self.run_test(
            "Train Booking - Odd Day (Ali-Sabieh)",
            "POST",
            "train/book",
            200,
            data={
                "route": {
                    "from": "Ali-Sabieh",
                    "to": "Holl-Holl",
                    "price": 400
                },
                "date": odd_date,
                "passenger": {
                    "fullName": "Test Passenger 2",
                    "phone": "+253 77 12 34 57",
                    "passportId": "DJ123457",
                    "nationalId": "CNI790"
                },
                "payment_method": "dmoney"
            },
            headers=user_headers
        )
        
        # Test train booking for 1st of month (should fail - holiday)
        holiday_date = "2025-02-01"  # 1st of month
        success, response = self.run_test(
            "Train Booking - Holiday (1st of month)",
            "POST",
            "train/book",
            400,  # Should fail
            data={
                "route": {
                    "from": "Nagad",
                    "to": "Dire-Dawa",
                    "price": 3200
                },
                "date": holiday_date,
                "passenger": {
                    "fullName": "Test Passenger 3",
                    "phone": "+253 77 12 34 58",
                    "passportId": "DJ123458"
                },
                "payment_method": "cacbank"
            },
            headers=user_headers
        )

    def test_ferry_booking(self):
        """Test ferry booking functionality"""
        self.log("=== Testing Ferry Booking ===")
        
        if not self.user_token:
            self.log("❌ No user token available, skipping ferry booking tests", "ERROR")
            return
        
        user_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.user_token}'
        }
        
        # Test ferry booking for Tadjoura (Tuesday)
        tuesday_date = "2025-01-21"  # Tuesday
        success, response = self.run_test(
            "Ferry Booking - Tadjoura (Tuesday)",
            "POST",
            "ferry/book",
            200,
            data={
                "route": {
                    "from": "Djibouti",
                    "to": "Tadjoura",
                    "time": "08:00",
                    "price": 700
                },
                "date": tuesday_date,
                "passenger": {
                    "fullName": "Ferry Passenger 1",
                    "phone": "+253 77 12 34 59",
                    "passportId": "DJ123459",
                    "nationalId": "CNI791"
                },
                "payment_method": "waafi"
            },
            headers=user_headers
        )
        
        # Test ferry booking for Obock (Sunday)
        sunday_date = "2025-01-19"  # Sunday
        success, response = self.run_test(
            "Ferry Booking - Obock (Sunday)",
            "POST",
            "ferry/book",
            200,
            data={
                "route": {
                    "from": "Djibouti",
                    "to": "Obock",
                    "time": "08:00",
                    "price": 700
                },
                "date": sunday_date,
                "passenger": {
                    "fullName": "Ferry Passenger 2",
                    "phone": "+253 77 12 34 60",
                    "nationalId": "CNI792"
                },
                "payment_method": "dmoney"
            },
            headers=user_headers
        )
        
        # Test return trip - Tadjoura to Djibouti (Thursday)
        thursday_date = "2025-01-23"  # Thursday
        success, response = self.run_test(
            "Ferry Booking - Return Trip (Thursday)",
            "POST",
            "ferry/book",
            200,
            data={
                "route": {
                    "from": "Tadjoura",
                    "to": "Djibouti",
                    "time": "12:00",
                    "price": 700
                },
                "date": thursday_date,
                "passenger": {
                    "fullName": "Ferry Passenger 3",
                    "phone": "+253 77 12 34 61",
                    "passportId": "DJ123461"
                },
                "payment_method": "cacbank"
            },
            headers=user_headers
        )

    def run_all_tests(self):
        """Run all tests in sequence"""
        self.log("🚀 Starting D-Billet API Tests")
        self.log(f"Base URL: {self.base_url}")
        
        # Run tests in order
        self.test_database_seeding()
        self.test_authentication()
        self.test_events()
        self.test_admin_events()
        self.test_cart_operations()
        self.test_checkout_process()
        self.test_tickets()
        self.test_admin_dashboard()
        self.test_admin_scanner()
        
        # NEW: Test Train and Ferry booking
        self.test_train_booking()
        self.test_ferry_booking()
        
        # Print summary
        self.log("=" * 50)
        self.log(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.failed_tests:
            self.log("❌ Failed Tests:")
            for test in self.failed_tests:
                self.log(f"  - {test.get('test', 'Unknown')}: {test.get('error', test.get('response', 'Unknown error'))}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = DBilletAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
