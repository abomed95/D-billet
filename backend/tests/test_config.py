"""
Test Configuration - Secure credentials management
All test credentials should be loaded from environment variables or this config
DO NOT hardcode actual production credentials
"""
import os

# Load from environment variables with fallback test defaults
# These are TEST-ONLY credentials, not for production
class TestConfig:
    # API URL
    API_URL = os.environ.get('TEST_API_URL', 'https://dbillet-preview.preview.emergentagent.com/api')
    
    # Test user credentials (use env vars in CI/CD)
    ADMIN_EMAIL = os.environ.get('TEST_ADMIN_EMAIL', 'admin@dbillet.dj')
    ADMIN_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', 'admin123')
    
    ORGANIZER_EMAIL = os.environ.get('TEST_ORGANIZER_EMAIL', 'organizer@dbillet.dj')
    ORGANIZER_PASSWORD = os.environ.get('TEST_ORGANIZER_PASSWORD', 'organizer123')
    
    FERRY_ORG_EMAIL = os.environ.get('TEST_FERRY_ORG_EMAIL', 'ferry@dbillet.dj')
    FERRY_ORG_PASSWORD = os.environ.get('TEST_FERRY_ORG_PASSWORD', 'ferry123')
    
    TRAIN_ORG_EMAIL = os.environ.get('TEST_TRAIN_ORG_EMAIL', 'train@dbillet.dj')
    TRAIN_ORG_PASSWORD = os.environ.get('TEST_TRAIN_ORG_PASSWORD', 'train123')
    
    TEST_PHONE = os.environ.get('TEST_PHONE', '+25377123456')
    
    @classmethod
    def get_admin_credentials(cls):
        return {"email": cls.ADMIN_EMAIL, "password": cls.ADMIN_PASSWORD}
    
    @classmethod
    def get_organizer_credentials(cls):
        return {"email": cls.ORGANIZER_EMAIL, "password": cls.ORGANIZER_PASSWORD}
    
    @classmethod
    def get_ferry_org_credentials(cls):
        return {"email": cls.FERRY_ORG_EMAIL, "password": cls.FERRY_ORG_PASSWORD}
    
    @classmethod
    def get_train_org_credentials(cls):
        return {"email": cls.TRAIN_ORG_EMAIL, "password": cls.TRAIN_ORG_PASSWORD}


# For pytest fixtures
def get_test_config():
    return TestConfig()
