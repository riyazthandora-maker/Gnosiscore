from supabase import create_client, Client
from app.config import settings

# Service-role client — bypasses RLS for trusted backend operations
def get_supabase() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
