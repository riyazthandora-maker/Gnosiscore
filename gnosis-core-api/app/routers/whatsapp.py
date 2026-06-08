"""
WhatsApp OTP via Twilio Verify.

These endpoints are called by the Next.js API routes (not the browser directly),
so they are protected by the internal API key — the Next.js layer validates the
user's Supabase session before proxying here.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from twilio.rest import Client as TwilioClient
from twilio.base.exceptions import TwilioRestException

from app.config import settings
from app.database import get_supabase

router = APIRouter(prefix="/auth/whatsapp", tags=["whatsapp"])


def verify_internal_key(x_internal_key: str = Header(...)):
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid internal API key")


def get_twilio() -> TwilioClient:
    if not settings.twilio_account_sid:
        raise HTTPException(status_code=503, detail="WhatsApp OTP is not configured.")
    return TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token)


class SendOTPRequest(BaseModel):
    user_id: str
    phone_number: str  # E.164 format e.g. +971501234567


class VerifyOTPRequest(BaseModel):
    user_id: str
    phone_number: str
    code: str


@router.post("/send", dependencies=[Depends(verify_internal_key)])
def send_otp(body: SendOTPRequest):
    """Send a WhatsApp OTP to the given number via Twilio Verify."""
    twilio = get_twilio()
    try:
        twilio.verify.v2.services(settings.twilio_verify_service_sid).verifications.create(
            to=f"whatsapp:{body.phone_number}",
            channel="whatsapp",
        )
    except TwilioRestException as e:
        raise HTTPException(status_code=400, detail=str(e.msg))

    return {"sent": True, "phone_number": body.phone_number}


@router.post("/verify", dependencies=[Depends(verify_internal_key)])
def verify_otp(body: VerifyOTPRequest):
    """Verify the OTP; on success, mark the user's WhatsApp as verified in DB."""
    twilio = get_twilio()
    try:
        check = twilio.verify.v2.services(settings.twilio_verify_service_sid).verification_checks.create(
            to=f"whatsapp:{body.phone_number}",
            code=body.code,
        )
    except TwilioRestException as e:
        raise HTTPException(status_code=400, detail=str(e.msg))

    if check.status != "approved":
        raise HTTPException(status_code=400, detail="Incorrect or expired OTP.")

    supabase = get_supabase()
    supabase.table("users").update({
        "whatsapp_verified": True,
        "whatsapp_number": body.phone_number,
    }).eq("id", body.user_id).execute()

    return {"verified": True}
