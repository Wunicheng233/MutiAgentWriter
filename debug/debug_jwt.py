
#!/usr/bin/env python3
import os
os.makedirs("logs", exist_ok=True)
from backend.auth import create_access_token, decode_token
from core.config import settings

# Create a new token with current settings
access_token = create_access_token(data={"sub": 1})
print(f"New token created: {access_token[:60]}...")
print()

# Try to decode it
payload = decode_token(access_token)
if payload is None:
    print("❌ FAILED: Cannot decode newly created token with current settings")
    print("This is very bad — something is wrong with the configuration")
else:
    print(f"✅ SUCCESS: Decoded newly created token: {payload}")
    print("JWT signing and verification works with current configuration")
