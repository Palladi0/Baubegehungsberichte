import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!

export const twilioClient = twilio(accountSid, authToken)

export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(authToken, signature, url, params)
}

export function twimlResponse(message: string): string {
  const twiml = new twilio.twiml.MessagingResponse()
  twiml.message(message)
  return twiml.toString()
}
