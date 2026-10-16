// Writes cases.jsonl. All content is synthetic: fictional banks, numbers (7000xxxxxx) and IDs.
import { writeFileSync } from "node:fs";
const S = (id, scam_type, text, extra = {}) => ({ id, kind: "text", label: "scam", scam_type, text, ...extra });
const L = (id, text, extra = {}) => ({ id, kind: "text", label: "legit", text, ...extra });
const cases = [
  // ---- scams: 20 text covering every scam type
  S("s01", "kyc_update", "Your SBI YONO account is suspended. Update PAN and Aadhaar now to reactivate: http://sbi-yono-kyc.top/login"),
  S("s02", "kyc_update", "Dear customer, your Airtel Payments Bank KYC expires today and your wallet will be frozen. Call 7000033331 immediately to update."),
  S("s03", "fake_payment", "Sir payment of Rs 8000 sent to your number by mistake. Please return Rs 8000 to 7000044441 urgently, I am in hospital."),
  S("s04", "fake_payment", "Buyer here. I have paid Rs 12,500 for the sofa, check the screenshot, the bank will credit in 2 hours. Please ship it now, courier is waiting."),
  S("s05", "qr_receive_scam", "To receive your Rs 3000 refund, scan this QR code from your PhonePe and enter your UPI PIN to accept the money."),
  S("s06", "digital_arrest", "This is Mumbai Cyber Police. A case of money laundering is registered against your Aadhaar. Stay on video call, tell nobody, and transfer Rs 90,000 to the RBI safe account to clear your name."),
  S("s07", "digital_arrest", "TRAI notice: your mobile number will be disconnected in 2 hours for illegal activity. Press 9 to speak to the customs officer now."),
  S("s08", "job_task", "Part-time job! Earn Rs 5000 daily by liking YouTube videos. Join our Telegram group t.me/earnfast_hr and pay a refundable task fee of Rs 1000 to start."),
  S("s09", "job_task", "Hi, I am HR Neha from Amazon. Work from home, rate products, Rs 800 per task, daily payout. Message me on WhatsApp 7000055551 to begin."),
  S("s10", "investment", "Join our VIP stock tips group. Guaranteed 300% returns in 15 days with insider IPO allotment. Minimum investment Rs 10,000. Limited seats."),
  S("s11", "investment", "Deposit USDT today and we double it in 24 hours, 100% guaranteed. Already 4,000 members earned. Send your wallet address to join."),
  S("s12", "loan_app", "Instant loan Rs 50,000 in 5 minutes, no documents. Install the APK from http://quickcash-loan.xyz/app.apk. Processing fee Rs 2000 payable first."),
  S("s13", "lottery_prize", "Congratulations! You have won the KBC lottery of Rs 25,00,000. Pay Rs 5,000 processing fee to claim your prize. WhatsApp 7000066661."),
  S("s14", "lottery_prize", "Your mobile number has won an iPhone 16 in the Flipkart lucky draw. Claim within 1 hour: http://flipkart-lucky.win/claim"),
  S("s15", "delivery_customs", "Your parcel from the UK is held at Delhi customs. Pay Rs 4,350 customs duty at http://indiapost-customs.top to release it today."),
  S("s16", "delivery_customs", "India Post: delivery failed due to an incomplete address. Update your address within 12 hours or the parcel is returned: http://ind-post.vip/addr"),
  S("s17", "impersonation_bank", "This is HDFC Bank fraud department. A transaction of Rs 49,999 is pending on your card. Share the OTP you just received to cancel it."),
  S("s18", "phishing_link", "Your electricity bill is unpaid and power will be cut tonight at 9:30 pm. Pay now: http://bses-pay.top/bill or call 7000077771."),
  S("s19", "sextortion", "I recorded your private video call. Send Rs 20,000 to bnbhelp.desk@ybl in 1 hour or I will send it to all your contacts and family."),
  S("s20", "other", "Hi Mom, I lost my phone, this is my new number. Please send Rs 15,000 urgently to this account 50100123456789, I will explain later. Don't call."),
  // ---- scams: 2 Hinglish
  S("s21", "kyc_update", "Aapka bank account aaj band ho jayega. KYC update karne ke liye is link par click karein aur OTP bataiye: http://kyc-update-now.top"),
  S("s22", "digital_arrest", "Sir aapke naam par ek parcel pakda gaya hai jisme drugs hain. CBI officer se baat karne ke liye abhi video call par aaiye aur kisi ko mat bataiye."),
  // ---- scams: the 4 example inputs
  S("s23", "kyc_update", "Dear BNB customer, your account will be BLOCKED today due to pending KYC. Update now: https://bnb-kyc-update.web.app or call 7000011111. -BNB Bank"),
  { id: "s24", kind: "image", label: "scam", scam_type: "fake_payment", asset: "web/public/examples/fake-payment.png", mime: "image/png", text: "A buyer sent me this payment screenshot and wants me to ship the item now. Is it genuine?" },
  { id: "s25", kind: "image", label: "scam", scam_type: "qr_receive_scam", asset: "web/public/examples/qr-receive.png", mime: "image/png", text: "Scan this QR to receive your ₹5,000 cashback" },
  { id: "s26", kind: "audio", label: "scam", scam_type: "digital_arrest", asset: "web/public/examples/digital-arrest.mp3", mime: "audio/mpeg" },
  // ---- genuine: 22 text
  L("g01", "HDFC Bank: Rs 1,250.00 debited from A/c XX4521 on 14-10-26 at SWIGGY. Avl Bal Rs 18,430.55. If not you, call 18002586161."),
  L("g02", "Dear Customer, Rs 25,000.00 credited to your A/c XX3321 on 15-10-26 by NEFT from ACME PVT LTD. Avl Bal Rs 61,440.12. -SBI"),
  L("g03", "482913 is your OTP for login to Zomato. Do not share this OTP with anyone. Valid for 10 minutes."),
  L("g04", "OTP for txn of INR 2,500 at AMAZON is 771204. Do not share with anyone, including bank staff. -ICICI Bank"),
  L("g05", "Your Amazon order #402-1234567 has been shipped and will arrive tomorrow by 8 PM. Track it in the Amazon app under Your Orders."),
  L("g06", "Delhivery: your package AWB 1234567890 is out for delivery today. Please keep Rs 0 ready, this order is prepaid."),
  L("g07", "You have received Rs 500.00 from RAHUL SHARMA (rahul.sharma@okaxis) via UPI. UPI Ref 427118903321. -Paytm Payments Bank"),
  L("g08", "Your BESCOM electricity bill of Rs 1,284 for Sep 2026 is generated. Due date 25-Oct-26. Pay in the official BESCOM app or on the website."),
  L("g09", "Jio: Your plan of Rs 299 expires on 20 Oct. Recharge on the MyJio app to keep enjoying your benefits."),
  L("g10", "IndiGo: your flight 6E 204 DEL-BOM on 18 Oct departs 06:45 from Terminal 1D. Web check-in is open in the IndiGo app."),
  L("g11", "Press Information Bureau advisory: Banks never ask for your OTP, PIN or CVV over phone, SMS or email. Report cyber fraud on cybercrime.gov.in or call 1930."),
  L("g12", "Reminder: your appointment with Dr. Mehta at Apollo Clinic is tomorrow at 11:30 AM. Reply 1 to confirm or 2 to reschedule."),
  L("g13", "Hey, running 10 minutes late, start without me. I'll order the pizza on the way."),
  L("g14", "Your HDFC Bank credit card statement for September is ready. Total due Rs 8,420, minimum due Rs 420, due date 05-Oct. View it in the HDFC app."),
  L("g15", "EPFO: your PF passbook for UAN 1012XXXX is updated. Contribution of Rs 2,150 credited for Sep 2026."),
  L("g16", "Swiggy: your order from Meghana Foods has been delivered. Rate your experience in the app. Enjoy your meal!"),
  L("g17", "LIC: premium of Rs 12,000 for policy no. XXXX4521 is due on 28-Oct. Pay through the LIC Customer app or at your nearest branch."),
  L("g18", "IRCTC: PNR 4521398760 confirmed. Train 12951 Mumbai Central to New Delhi on 20-Oct-26, Coach B2, Seat 34. Happy journey!"),
  L("g19", "Greenfield School: the parent-teacher meeting is on Saturday 19 Oct at 10 AM. Please attend with your ward."),
  L("g20", "Hi Priya, thank you for interviewing with us. We would like to offer you the Analyst role. The offer letter is attached; please review it and reply by Friday."),
  L("g21", "Dear Customer, never share your OTP, PIN or password with anyone. Bank officials never ask for it. -SBI"),
  L("g22", "Amazon: your refund of Rs 1,299 for order #402-7654321 has been credited to your original payment method. It may take 3-5 days to show in your statement."),
  // ---- genuine: 2 images
  { id: "g23", kind: "image", label: "legit", asset: "eval/assets/legit-receipt.png", mime: "image/png", text: "My friend sent me this payment screenshot for the concert tickets. Looks fine?" },
  { id: "g24", kind: "image", label: "legit", asset: "eval/assets/legit-pay-qr.png", mime: "image/png", text: "Scan this QR to pay Sharma General Store Rs 250 for groceries" },
];
writeFileSync(new URL("./cases.jsonl", import.meta.url), cases.map((c) => JSON.stringify(c)).join("\n") + "\n");
const n = (f) => cases.filter(f).length;
console.log(cases.length, "cases:", n((c) => c.label === "scam"), "scam,", n((c) => c.label === "legit"), "legit");
