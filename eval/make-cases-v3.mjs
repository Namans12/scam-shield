// Writes cases-v3.jsonl: 50 realistic scams (all 13 scam types) and 50 realistic genuine messages, text only.
// Written to look like normal Indian SMS / WhatsApp / email traffic, in English, Hindi (Devanagari) and Hinglish. The mix is
// not tuned to be easy or hard: it is a plain spread, and nothing is changed after a run.
// All content is fictional (made-up banks, couriers, shops, 70000xxxxx numbers, made-up domains and UPI IDs). None of the
// identifiers appear in the seeded demo scam list (scripts/seed.ts), so these cases are NOT list-assisted; cases.test.ts enforces that.
// label: scam -> must be flagged (Scam or Suspicious); legit -> must NOT be flagged. No case is ever labelled "safe".
// category: "realistic_scam" for scams (the scam type is in scam_type); the topic of the message for genuine ones.
// Usage: node eval/make-cases-v3.mjs
import { writeFileSync } from "node:fs";
const S = (id, scam_type, tactic, text) => ({ id, kind: "text", label: "scam", expect: "flagged", category: "realistic_scam", tactic, scam_type, text });
const G = (id, category, tactic, text) => ({ id, kind: "text", label: "legit", expect: "not_flagged", category, tactic, text });
const cases = [
  // ---- scams (50): 13 types
  // kyc_update (4)
  S("v3s01", "kyc_update", "SMS, English, suspension threat with link", "HTB ALERT: Your Hindustan Trust Bank KYC has expired. Account will be suspended in 24 hrs. Update PAN & Aadhaar now: http://htb-kycupdate.xyz/login . Ignore = account freeze."),
  S("v3s02", "kyc_update", "SMS, Hindi, link plus OTP", "प्रिय ग्राहक, KYC पूरा न होने के कारण आपका सागर बैंक खाता आज रात बंद कर दिया जाएगा। तुरंत अपडेट करें: http://sagarbank-kyc.top/hi और अपना OTP साझा करें।"),
  S("v3s03", "kyc_update", "WhatsApp, fake bank officer, APK install", "Good afternoon sir, I am calling from Kaveri Bank KYC department. Your PAN is not linked and your account will be blocked today. I am sending you a file KaveriKYC.apk on WhatsApp, please install it and enter your card number and PIN to complete the verification."),
  S("v3s04", "kyc_update", "Hinglish, wallet KYC", "Aapka MobiPay wallet KYC pending hai. Aaj raat 12 baje se wallet limit lock ho jayega. Call karein 7000094412 ya link kholein mobipay-kyc.in.net aur Aadhaar number, OTP daalein."),
  // fake_payment (4)
  S("v3s05", "fake_payment", "WhatsApp, wrong transfer, collect request with PIN", "Hi, I accidentally sent Rs 8,000 to your number instead of my brother's. Please approve the collect request I am sending now to return it, just enter your UPI PIN on the request. Urgent, my child is in the hospital."),
  S("v3s06", "fake_payment", "SMS, fake refund with remote access", "ShopKart: refund of Rs 3,799 is pending for your cancelled order. To receive it, share the 9-digit code from the AnyDesk app or open http://shopkart-refunds.top/claim and enter your card details."),
  S("v3s07", "fake_payment", "WhatsApp, fake buyer, verification amount", "Sir I have paid Rs 14,500 for the sofa, but the payment shows pending. Please pay Rs 500 back as verification amount to unlock it, then both amounts will get credited together. Screenshot attached."),
  S("v3s08", "fake_payment", "Hinglish, fake cashback to be accepted", "Aapke GPay par Rs 4,999 cashback aaya hai. Receive karne ke liye request accept karke apna PIN daalein. Offer 24 ghante mein expire hoga."),
  // qr_receive_scam (3)
  S("v3s09", "qr_receive_scam", "WhatsApp, marketplace buyer, scan to receive advance", "I will buy your fridge, no bargaining. I am sending you a QR code, scan it to receive the advance of Rs 2,000 and then I will pay the rest. Scan karke PIN dalna."),
  S("v3s10", "qr_receive_scam", "Hinglish SMS, refund by QR", "Sir aapka Rs 6,000 refund ready hai. Neeche diye QR ko scan karein aur PIN enter karein, paisa seedha aapke account mein aayega. QR attached."),
  S("v3s11", "qr_receive_scam", "WhatsApp, fake subsidy by QR", "Your electricity subsidy of Rs 1,850 is approved. Scan the QR attached with any UPI app and enter your PIN to receive the amount in your bank account today."),
  // digital_arrest (4)
  S("v3s12", "digital_arrest", "call script as text, seized parcel, safe account", "This is Inspector Rao from Cyber Crime Branch Mumbai. A parcel in your name with 4 passports and drugs was seized at the airport. You are under digital arrest. Stay on the video call, do not tell anyone, and transfer Rs 2,50,000 to the RBI safe account for verification. Call 7000094501."),
  S("v3s13", "digital_arrest", "Hindi, money laundering case, video call", "आपके आधार नंबर से मनी लॉन्ड्रिंग का केस दर्ज हुआ है। CBI अधिकारी आपसे वीडियो कॉल पर बात करेंगे। कॉल कट न करें, किसी को न बताएं, वरना गिरफ्तारी होगी। जमानत के लिए 90,000 रुपये अभी जमा करें।"),
  S("v3s14", "digital_arrest", "Hinglish, telecom regulator threat", "TRAI notice: aapke mobile number se illegal calls ki complaint mili hai, 2 ghante mein number disconnect hoga. Press 9 ya Mumbai Police se baat karein. Aapke khilaf FIR ho sakti hai."),
  S("v3s15", "digital_arrest", "WhatsApp, ED officer, stay home camera on", "Sir, I am ED officer Verma. Your bank account is used in a hawala case. For the investigation you must remain at home with the camera ON. Share your account balance and we will verify it in a supervised account. Non-compliance means an arrest warrant by evening."),
  // job_task (4)
  S("v3s16", "job_task", "WhatsApp, rating task job", "Hi! Part time job offer. Earn Rs 500-5000 daily by rating hotels on Maps. No experience needed. WhatsApp HR Priya: wa.me/917000094610. Salary paid daily."),
  S("v3s17", "job_task", "Telegram, task earnings then deposit", "Congrats, you completed 3 tasks and earned Rs 450! To unlock the next level and withdraw, deposit Rs 3,000 (refunded with commission Rs 4,200). Join our Telegram group for the next task."),
  S("v3s18", "job_task", "Hinglish, data entry with security deposit", "Aapka resume shortlist hua hai. Data entry ki job, Rs 28,000 monthly, work from home. Joining ke liye security deposit Rs 1,800 aur laptop courier charges Rs 950 bharna hoga. Offer letter payment ke baad milega."),
  S("v3s19", "job_task", "email style, overseas job with fees", "Subject: Offer of employment, Gulf Logistics HR\n\nDear candidate, you are selected for the post of warehouse supervisor in Dubai, salary AED 3,500. To proceed, remit Rs 6,500 as visa and medical processing fee to the account given below within 48 hours. Your offer letter will be released after payment."),
  // investment (4)
  S("v3s20", "investment", "WhatsApp, stock tips group", "Welcome to Profit Bulls VIP group! Our SEBI-registered analyst gives 100% sure tips. Last week members made 40% return. Join the premium group for Rs 4,999 and download the trading app from http://profitbulls-app.top"),
  S("v3s21", "investment", "SMS, crypto daily returns", "Invest Rs 10,000 in our USDT mining plan and get Rs 1,000 daily guaranteed return. Withdraw anytime. Limited slots, 100+ happy members in your city."),
  S("v3s22", "investment", "Hinglish, pre-IPO", "Pre-IPO shares ka mauka! Sirf aaj ke liye institutional quota, 3x return pakka. Rs 25,000 se start karein. Pehle fund transfer karein, allotment kal subah."),
  S("v3s23", "investment", "email style, AI trading bot", "Subject: Capital-protected weekly returns\n\nDear Investor, our AI trading bot guarantees 8% weekly returns with zero risk. Recommended by leading business personalities. Register today and deposit a minimum of Rs 20,000 through the link: http://aibot-wealth.xyz/register"),
  // loan_app (4)
  S("v3s24", "loan_app", "SMS, instant loan with upfront fee", "Instant loan Rs 50,000 in 5 mins, no CIBIL check, no documents! Install the QuickRupee app: http://quickrupee-loan.top/app . Processing fee Rs 1,200 payable first."),
  S("v3s25", "loan_app", "SMS, recovery threat with contacts", "You have not repaid the Rs 5,000 loan from the CashNow app. Your contact list has been accessed. We will send your edited photos to all your contacts and relatives tomorrow if you do not pay Rs 9,500 by 5 PM."),
  S("v3s26", "loan_app", "Hinglish, approved loan with insurance fee", "Aapka loan approve ho gaya Rs 2,00,000. Insurance aur GST charge Rs 3,500 pehle bhejein, phir paisa aapke account mein aa jayega. Sirf aaj ka offer."),
  S("v3s27", "loan_app", "Hindi, shaming threat", "आपने ऐप से लोन लिया था और भुगतान नहीं किया। हम आपके सभी रिश्तेदारों को आपको धोखेबाज़ बताकर मैसेज भेजेंगे। आज ही 7,200 रुपये इस UPI पर भेजें: loanrecovery.cell@oksagar"),
  // lottery_prize (4)
  S("v3s28", "lottery_prize", "WhatsApp, KBC lucky draw", "KBC Lucky Winner! Your mobile number has won Rs 25,00,000 in the Kaun Banega Crorepati lucky draw. WhatsApp 7000094721 with ref no KBC/26/7781. Pay Rs 5,900 tax to claim your prize."),
  S("v3s29", "lottery_prize", "Hindi, car prize with fee", "बधाई हो! आपका नंबर सन फेस्टिवल लकी ड्रॉ में चुना गया है, आपने एक नई कार जीती है। इनाम पाने के लिए 3,500 रुपये प्रोसेसिंग फीस भेजें।"),
  S("v3s30", "lottery_prize", "email style, foreign lottery", "Subject: Winner notification\n\nYour email address was selected in the Global Millions online draw and you have won GBP 850,000. Contact our claims agent, send a copy of your passport and pay the transfer fee of Rs 12,000 to release the funds."),
  S("v3s31", "lottery_prize", "SMS, recharge scratch card", "You received a scratch card on your Rs 500 recharge: you have won a new smartphone. Click http://megarecharge-gift.top/scratch to claim, pay delivery Rs 299."),
  // delivery_customs (4)
  S("v3s32", "delivery_customs", "SMS, redelivery fee link", "Swiftpost: your parcel could not be delivered due to an incomplete address. Update within 12 hours or it returns to sender: http://swiftpost-redelivery.top/addr (re-delivery fee Rs 28)."),
  S("v3s33", "delivery_customs", "call script as text, illegal items in parcel", "This is Quickship customer care. A parcel booked with your Aadhaar contains illegal items and is held at the Andheri customs office. Press 1 to connect to the customs officer."),
  S("v3s34", "delivery_customs", "Hinglish, clearance charges by UPI", "Aapka international gift parcel customs mein ruka hai. Clearance charges Rs 4,750 UPI karein warna parcel wapas bhej diya jayega. Pay karein: 7000094833"),
  S("v3s35", "delivery_customs", "email style, duty payment link", "Subject: Package awaiting clearance\n\nGlobal Cargo Notice: package GC-4471 is awaiting customs clearance. A duty of Rs 2,980 is due within 48 hours. Pay at http://globalcargo-duty.xyz/pay or the package will be returned."),
  // impersonation_bank (4)
  S("v3s36", "impersonation_bank", "call script as text, credit limit OTP", "Dear Sir, this is the Sagar Finance Bank credit card department. Your credit limit increase of Rs 3 lakh is approved. For activation please tell me the OTP that has just been sent to you."),
  S("v3s37", "impersonation_bank", "SMS, card deactivation with phone number", "Your Hindustan Trust Bank debit card ending 5521 will be deactivated today. Call 7000094902 immediately to avoid blocking. Keep your card number and CVV ready."),
  S("v3s38", "impersonation_bank", "Hinglish, fake manager, cancel transaction with OTP", "Sir main bank manager bol raha hoon. Aapke account se suspicious transaction ho raha hai Rs 49,000. Cancel karne ke liye abhi OTP bataiye jo aapko aaya hai."),
  S("v3s39", "impersonation_bank", "SMS, reward points APK", "Kaveri Bank: your credit card reward points worth Rs 7,250 will lapse tonight. Redeem through the app: kaveribank-rewards.in.net/redeem (install the APK)."),
  // phishing_link (4)
  S("v3s40", "phishing_link", "SMS, electricity disconnection with link", "Dear consumer, your electricity connection will be disconnected tonight at 9:30 PM because last month's bill is not updated. Update now: http://sunrisepower-billpay.top/update -Sunrise Power"),
  S("v3s41", "phishing_link", "SMS, e-challan fine link", "Traffic Dept: vehicle MH99XX0000 has a pending e-challan of Rs 500. Pay now to avoid a court notice: http://echallan-parivahan.top/pay"),
  S("v3s42", "phishing_link", "SMS, tax refund link", "Income Tax Dept: a refund of Rs 18,640 is approved for you. Submit your bank details at http://incometax-refund.xyz/claim within 24 hours."),
  S("v3s43", "phishing_link", "SMS, SIM block link", "Your SIM will be blocked in 2 hours as per new DoT rules. Verify your identity now: http://sim-verify-dot.top"),
  // sextortion (3)
  S("v3s44", "sextortion", "SMS, video call recording threat", "I have recorded your video from the video call last night. Pay Rs 20,000 to this UPI or I will send it to all your Facebook friends and relatives. You have 3 hours."),
  S("v3s45", "sextortion", "Hinglish, private video threat", "Tumhari private video mere paas hai. Rs 15,000 bhejo warna tumhare ghar walon aur office mein bhej dunga. Police ke paas gaye to viral kar dunga."),
  S("v3s46", "sextortion", "email style, webcam hack bitcoin", "Subject: Your privacy\n\nI hacked your webcam and recorded you while you were visiting adult websites. Send the equivalent of USD 800 in bitcoin to the wallet address I will send next, within 48 hours, or the video goes to all your contacts."),
  // other (4)
  S("v3s47", "other", "pop-up style text, fake tech support", "WARNING: your phone has 3 viruses! Call the Mobile Security Helpline 7000095202 immediately. Do not switch off or all your SIM data will be erased. -Technical Support Team"),
  S("v3s48", "other", "WhatsApp, charity appeal with UPI", "Help save 6 year old Aarav, who has blood cancer. The hospital needs Rs 4 lakh by Friday. Donate now via UPI hopeforaarav@oksagar. Registered NGO, 80G tax exempt. Please forward to 10 groups and send the payment screenshot."),
  S("v3s49", "other", "WhatsApp, relative with a new number", "Hi uncle, it's me Rahul, this is my new number, my phone fell in water. I need Rs 18,000 urgently for the exam form fee, please send it to 7000095344 (PhonePe), will return tomorrow. Don't call, my voice is not clear."),
  S("v3s50", "other", "WhatsApp, rental advance from a posted officer", "Flat for rent in Powai, 2BHK at Rs 18,000. I am an army officer posted at Leh, so cannot show it in person. Photos on WhatsApp. Pay a token of Rs 5,000 advance to block the flat and my courier will send the keys."),
  // ---- genuine (50)
  // bank alerts (7)
  G("v3g01", "bank_alert", "UPI debit alert, no link", "HTB: Rs 1,250.00 debited from A/c XX3318 on 18-10-26 at CAFE AROMA via UPI. Avl bal Rs 31,402.55. If not done by you, call the number on the back of your card."),
  G("v3g02", "bank_alert", "NEFT credit alert", "HTB: Rs 45,000.00 credited to A/c XX3318 on 17-10-26 by NEFT from LAKEVIEW TECH PVT LTD. Avl bal Rs 76,402.55."),
  G("v3g03", "bank_alert", "credit card spend alert with app instruction", "Kaveri Bank Credit Card XX9021: Rs 6,480 spent at SHOPKART on 16-Oct-26. Available limit Rs 1,13,520. Not you? Block the card in the Kaveri Bank app under Cards."),
  G("v3g04", "bank_alert", "Hindi debit alert", "प्रिय ग्राहक, आपके खाते XX4455 से 18-10-26 को 900 रुपये UPI से काटे गए। उपलब्ध शेष 14,320 रुपये। -सागर बैंक"),
  G("v3g05", "bank_alert", "low balance notice", "Sagar Bank: your A/c XX7710 balance is below Rs 1,000 (Rs 640.20 as of 18-Oct). Please maintain the minimum balance to avoid charges."),
  G("v3g06", "bank_alert", "credit card statement reminder", "Your Kaveri Bank credit card statement for Sep-Oct is ready. Total due Rs 12,340, minimum due Rs 620, due date 05-Nov-26. View it in the app or net banking. -Kaveri Bank"),
  G("v3g07", "bank_alert", "FD maturity notice", "HTB: your FD no. XXXX2290 of Rs 1,00,000 matures on 25-Oct-26. It will auto-renew for the same tenure unless you instruct otherwise at the branch or in the app."),
  // OTPs (5)
  G("v3g08", "otp", "login OTP with do-not-share", "482910 is your OTP for login on ShopKart. Do not share it with anyone. ShopKart never calls to ask for your OTP."),
  G("v3g09", "otp", "card transaction OTP", "OTP 771203 for a transaction of Rs 2,499 at TRAVELPORT with your HTB card ending 5521. Valid for 10 mins. Never share your OTP, PIN or CVV with anyone, including bank staff."),
  G("v3g10", "otp", "telecom login code", "Use 640172 as your Vodatel login code. Do not share it with anyone, including Vodatel employees."),
  G("v3g11", "otp", "UPI registration OTP", "Your Sagar Bank UPI registration OTP is 918274. Do not share it with anyone."),
  G("v3g12", "otp", "utility portal OTP", "Your one-time password for the Sunrise Power consumer portal login is 553017. It expires in 10 minutes. Never share this code."),
  // delivery (5)
  G("v3g13", "delivery", "OTP for delivery, do not share on call", "Zippo Express: your order from CartKing will be delivered today. Share OTP 5521 with the delivery partner only at the time of delivery. Do not share it over a call."),
  G("v3g14", "delivery", "delivered confirmation", "Swiftpost: parcel SP-2208841 was delivered to your address on 17-Oct at 4:12 PM. Signed by: security desk. Contact support in the app if this is not right."),
  G("v3g15", "delivery", "Hinglish delivery window with rider name", "Aapka CartKing order kal 2 se 6 baje ke beech deliver hoga. Delivery boy Ravi (7000096110) aapko call karega."),
  G("v3g16", "delivery", "failed attempt, no payment needed", "Zippo Express: a delivery attempt failed as no one was available. We will retry tomorrow. You can also reschedule in the Zippo Express app. No payment is needed."),
  G("v3g17", "delivery", "food delivery cash on delivery", "Your KhanaKart order #44721 is on the way. Rider Imran is 8 mins away. Pay Rs 349 in cash on delivery, or ignore this if you paid online."),
  // bills (6)
  G("v3g18", "bill", "electricity bill reminder", "Sunrise Power: the bill for Oct-26 of Rs 1,873 is generated for consumer no. XXXX8820. Due 06-Nov-26. Pay on the Sunrise Power app or website. Ignore if already paid."),
  G("v3g19", "bill", "broadband auto-pay notice", "FiberNet: your broadband bill of Rs 826 is due on 22-Oct. Auto-pay is enabled, so no action is needed. Download the invoice from the FiberNet app."),
  G("v3g20", "bill", "LPG booking confirmation", "Your LPG cylinder refill is booked and will be delivered in 2-3 days. Pay Rs 905 to the delivery person by UPI or cash. Booking ID LP98812."),
  G("v3g21", "bill", "Hindi electricity bill", "सनराइज़ पावर: आपका सितंबर का बिजली बिल 1,420 रुपये का है, अंतिम तिथि 28 अक्टूबर। भुगतान सनराइज़ पावर ऐप से करें।"),
  G("v3g22", "bill", "water bill reminder", "City Water Board: the water bill of Rs 312 for Jul-Sep is due by 31-Oct-26. Pay at the ward office or on the board's official portal. A late fee applies after the due date."),
  G("v3g23", "bill", "prepaid plan expiry", "Vodatel: your plan of Rs 299 expires on 20-Oct. Recharge in the Vodatel app to keep enjoying 1.5 GB per day."),
  // salary and credits (4)
  G("v3g24", "salary_credit", "salary credit SMS", "Salary credited: Rs 52,300.00 credited to A/c XX3318 on 01-10-26 by LAKEVIEW TECH PVT LTD SALARY SEP. Avl bal Rs 61,018.20 -HTB"),
  G("v3g25", "salary_credit", "payslip available", "Dear Rohan, your payslip for September 2026 is available in the HR portal. Net pay Rs 52,300. Please contact HR for any query."),
  G("v3g26", "salary_credit", "Hinglish freelance payment credit", "Aapke account mein Rs 18,500 credit hue hain (freelance payment from Meera Designs). Avl bal Rs 24,110."),
  G("v3g27", "salary_credit", "provident fund contribution", "PF update: the employer contribution of Rs 3,600 for Sep-26 is credited to your EPF account. Check your passbook on the official EPFO member portal."),
  // appointments (4)
  G("v3g28", "appointment", "clinic reminder", "Reminder: your appointment with Dr. Mehra at Lakeview Clinic is on 20-Oct-26 at 5:30 PM. Reply C to confirm or call the clinic to reschedule. Fees are payable at the clinic."),
  G("v3g29", "appointment", "salon booking", "Hi, this is Glow Salon. Your booking for Sat 24 Oct at 11 AM is confirmed. See you!"),
  G("v3g30", "appointment", "Hindi vaccination slot", "आपका वैक्सीनेशन अपॉइंटमेंट 22 अक्टूबर को सुबह 10 बजे सिटी हेल्थ सेंटर में है। कृपया आधार कार्ड साथ लाएं।"),
  G("v3g31", "appointment", "car service reminder", "Service reminder: your car MH99AB0000 is due for its service at Metro Motors on 25-Oct. Call the workshop to book a slot."),
  // genuine KYC reminders (4)
  G("v3g32", "kyc_reminder", "visit branch or official app, no ask over call", "Kaveri Bank: periodic KYC update is due for your account. Please visit your branch with ID and address proof or update through the official Kaveri Bank app. We never ask for details over a call, SMS link or WhatsApp."),
  G("v3g33", "kyc_reminder", "visit any branch, do not share OTP", "Hindustan Trust Bank: dear customer, re-KYC is due by 31-Dec-26. Visit any HTB branch with Aadhaar and PAN. Do not share OTP or PIN with anyone. Call the number on your passbook for help."),
  G("v3g34", "kyc_reminder", "Hinglish, branch or net banking", "Sagar Bank: aapka KYC update due hai. Apni home branch mein jaakar form bharein ya net banking mein login karke update karein. Kisi ko OTP ya PIN na batayein."),
  G("v3g35", "kyc_reminder", "mutual fund KYC, no fee", "Your mutual fund folio XXXX441 needs KYC re-verification. Complete it on the official fund house website or visit the nearest investor service centre. No fee is charged."),
  // family and friends (5)
  G("v3g36", "family_chat", "Hinglish, parent sending money", "Beta, kal 12 baje mandir chalna hai. Aur sunn, tere account mein Rs 5,000 daal diye hain, Diwali ke kapde le lena."),
  G("v3g37", "family_chat", "friend repaying for tickets", "Bro thanks for booking the tickets. I will GPay you the Rs 1,200 tonight, ok?"),
  G("v3g38", "family_chat", "child paid the bill", "Mom, I paid the electricity bill from my phone, Rs 2,100. Don't pay it again. I will show you how tomorrow."),
  G("v3g39", "family_chat", "spouse about EMI", "Did you see the EMI reminder? I have kept Rs 18,000 in the joint account so it gets debited on the 5th. Please don't withdraw it."),
  G("v3g40", "family_chat", "friend asking for a short loan", "Hey, can you lend me Rs 3,000 till Friday? Rent is due and my salary is delayed. I will transfer it back on the 23rd, promise. Call me tonight if you want to talk."),
  // e-commerce (5)
  G("v3g41", "ecommerce", "shipped notice, track in app", "CartKing: your order #CK-77310 (wireless earphones) has been shipped and will arrive by 21 Oct. Track it in the CartKing app under My Orders."),
  G("v3g42", "ecommerce", "return pickup scheduled", "ShopKart: we received your return request for order #SK-90117. Pickup is scheduled for 19 Oct. The refund will be processed within 5-7 days after the quality check."),
  G("v3g43", "ecommerce", "cancellation and refund, no action", "Your order has been cancelled as per your request. Rs 1,299 will be refunded to the source account in 3-5 days. No action is needed."),
  G("v3g44", "ecommerce", "Hinglish rating request with discount", "Aapka KhanaKart order deliver ho gaya. Khana kaisa laga? App mein rating dein aur agle order par 10% off paayein."),
  G("v3g45", "ecommerce", "store invoice", "Thank you for shopping at MegaMart! Your invoice for Rs 3,420 (bill no. 88121) is in the MegaMart app. Returns are accepted within 15 days with the bill."),
  // government notices (3)
  G("v3g46", "govt_notice", "ITR verified, official domain", "Income Tax Department: your ITR for AY 2026-27 has been successfully e-verified. Acknowledgement no. XXXXXX1128. View the status at incometax.gov.in."),
  G("v3g47", "govt_notice", "licence renewal, official portal", "Parivahan: your driving licence renewal application is received. Track the status at parivahan.gov.in with your application number. No payment is requested over SMS."),
  G("v3g48", "govt_notice", "Aadhaar update, official domain", "UIDAI: the last date to update demographic details free of charge online is extended. Visit myaadhaar.uidai.gov.in or a nearby Aadhaar Seva Kendra. UIDAI never asks for your OTP over a phone call."),
  // scam-awareness posts (2)
  G("v3g49", "awareness", "awareness post about fake electricity messages", "Scam alert from the Cyber Cell: fake electricity bill disconnection messages are doing the rounds. Do not call the number given in them. Pay bills only through the official app. Report fraud on 1930 or cybercrime.gov.in."),
  G("v3g50", "awareness", "Hinglish awareness about lottery and loan apps", "Dosto savdhaan: KBC lottery ke WhatsApp messages fake hote hain, kisi ko paise mat bhejo. Aur koi bhi loan app jo contacts ki permission maange use install mat karo. Fraud ho to 1930 par report karein."),
];
writeFileSync(new URL("./cases-v3.jsonl", import.meta.url), cases.map((c) => JSON.stringify(c)).join("\n") + "\n");
const n = (f) => cases.filter(f).length;
console.log(cases.length, "cases:", n((c) => c.label === "scam"), "scams,", n((c) => c.label === "legit"), "genuine,", new Set(cases.filter((c) => c.scam_type).map((c) => c.scam_type)).size, "scam types");
