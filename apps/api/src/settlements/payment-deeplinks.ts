/**
 * MoMo deep-link generator.
 * Opens the MoMo app pre-filled with the recipient's phone number and transfer amount.
 *
 * Scheme: momo://transfer?phone=<phone>&amount=<amount>&note=<note>
 * Falls back to the MoMo web transfer URL when the app is not installed.
 */
export function generateMomoDeepLink(params: {
  phone: string;
  amount: number;
  note?: string;
}): { deepLink: string; webUrl: string } {
  const { phone, amount, note = '' } = params;
  const encodedPhone = encodeURIComponent(phone);
  const encodedNote = encodeURIComponent(note);

  const deepLink = `momo://transfer?phone=${encodedPhone}&amount=${amount}&note=${encodedNote}`;
  const webUrl = `https://nhantien.momo.vn/${encodedPhone}?amount=${amount}&note=${encodedNote}`;

  return { deepLink, webUrl };
}

/**
 * VNPay deep-link generator.
 * Opens the VNPay app pre-filled with transfer details.
 *
 * VNPay does not publish an official deep-link spec; this uses the QR-based
 * transfer URL which the app intercepts on mobile. The `amount` must be a
 * positive integer (VND has no decimal places).
 */
export function generateVNPayDeepLink(params: {
  bankAccount: string;
  amount: number;
  description?: string;
}): { deepLink: string; webUrl: string } {
  const { bankAccount, amount, description = '' } = params;
  const encodedAccount = encodeURIComponent(bankAccount);
  const encodedDesc = encodeURIComponent(description);

  const deepLink = `vnpay://transfer?account=${encodedAccount}&amount=${amount}&desc=${encodedDesc}`;
  const webUrl = `https://vnpay.vn/transfer?account=${encodedAccount}&amount=${amount}&desc=${encodedDesc}`;

  return { deepLink, webUrl };
}
