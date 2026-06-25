import { db } from "@workspace/db";
import {
  hospitalTable, usersTable, specializationsTable, doctorsTable,
  contactVariablesTable, leadsTable, activityLogTable, messagesTable,
  appointmentsTable, segmentsTable, templatesTable, templateRequestsTable,
  campaignsTable, campaignMetricsTable, walletTable, walletTransactionsTable,
  invoicesTable, channelConfigTable, sendRulesTable, notificationsTable, sessionTable,
  tagsTable, quickRepliesTable, uploadHistoryTable
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

async function clearAll(): Promise<void> {
  await db.delete(notificationsTable);
  await db.delete(uploadHistoryTable);
  await db.delete(invoicesTable);
  await db.delete(walletTransactionsTable);
  await db.delete(walletTable);
  await db.delete(campaignMetricsTable);
  await db.delete(campaignsTable);
  await db.delete(templateRequestsTable);
  await db.delete(templatesTable);
  await db.delete(segmentsTable);
  await db.delete(messagesTable);
  await db.delete(activityLogTable);
  await db.delete(appointmentsTable);
  await db.delete(leadsTable);
  await db.delete(contactVariablesTable);
  await db.delete(doctorsTable);
  await db.delete(specializationsTable);
  await db.delete(usersTable);
  await db.delete(channelConfigTable);
  await db.delete(sendRulesTable);
  await db.delete(quickRepliesTable);
  await db.delete(tagsTable);
  await db.delete(sessionTable);
  await db.delete(hospitalTable);
}

export async function runSeed(force = false): Promise<void> {
  const existing = await db.select().from(hospitalTable);
  if (existing.length > 0 && !force) {
    logger.info("Seed already run, skipping");
    return;
  }
  if (force) await clearAll();

  logger.info("Seeding demo data...");

  // Hospital
  await db.insert(hospitalTable).values({
    name: "Sunrise Multispecialty Hospital",
    logo: null,
    primaryColor: "#2563EB",
    contact: "+91-80-4567-8901",
    address: "42, Bannerghatta Road, Bengaluru, Karnataka 560076",
    simplifiedMode: false,
  });

  // Session
  await db.insert(sessionTable).values({ key: "active_role", value: "exec" });

  // Users
  const [u1, u2, u3] = await db.insert(usersTable).values([
    { name: "Priya Sharma", email: "priya.sharma@sunrisehospital.in", role: "exec", active: true },
    { name: "Rajeev Menon", email: "rajeev.menon@sunrisehospital.in", role: "manager", active: true },
    { name: "Arjun Kapoor", email: "arjun.kapoor@affordplan.in", role: "ap_admin", active: true },
  ]).returning();

  // Specializations
  const specs = await db.insert(specializationsTable).values([
    { name: "Cardiology" },
    { name: "Orthopedics" },
    { name: "Neurology" },
    { name: "Oncology" },
    { name: "Gynaecology" },
    { name: "Paediatrics" },
    { name: "Dermatology" },
    { name: "General Medicine" },
    { name: "Gastroenterology" },
    { name: "Urology" },
  ]).returning();

  // Doctors
  const [d1, d2, d3, d4, d5] = await db.insert(doctorsTable).values([
    {
      name: "Dr. Ananya Krishnan", specialization: "Cardiology",
      qualifications: "MBBS, MD, DM (Cardiology)", experience: 14,
      slots: [
        { day: "Monday", startTime: "09:00", endTime: "13:00" },
        { day: "Wednesday", startTime: "09:00", endTime: "13:00" },
        { day: "Friday", startTime: "14:00", endTime: "18:00" },
      ],
    },
    {
      name: "Dr. Ramesh Nair", specialization: "Orthopedics",
      qualifications: "MBBS, MS (Ortho), DNB", experience: 18,
      slots: [
        { day: "Tuesday", startTime: "10:00", endTime: "14:00" },
        { day: "Thursday", startTime: "10:00", endTime: "14:00" },
        { day: "Saturday", startTime: "09:00", endTime: "12:00" },
      ],
    },
    {
      name: "Dr. Meera Pillai", specialization: "Neurology",
      qualifications: "MBBS, MD, DM (Neurology)", experience: 11,
      slots: [
        { day: "Monday", startTime: "14:00", endTime: "18:00" },
        { day: "Thursday", startTime: "14:00", endTime: "18:00" },
      ],
    },
    {
      name: "Dr. Suresh Iyer", specialization: "General Medicine",
      qualifications: "MBBS, MD", experience: 22,
      slots: [
        { day: "Monday", startTime: "09:00", endTime: "17:00" },
        { day: "Tuesday", startTime: "09:00", endTime: "17:00" },
        { day: "Wednesday", startTime: "09:00", endTime: "17:00" },
        { day: "Thursday", startTime: "09:00", endTime: "17:00" },
        { day: "Friday", startTime: "09:00", endTime: "17:00" },
      ],
    },
    {
      name: "Dr. Kavitha Reddy", specialization: "Gynaecology",
      qualifications: "MBBS, MS (Gynae), FRCOG", experience: 16,
      slots: [
        { day: "Tuesday", startTime: "09:00", endTime: "13:00" },
        { day: "Wednesday", startTime: "14:00", endTime: "18:00" },
        { day: "Saturday", startTime: "09:00", endTime: "12:00" },
      ],
    },
  ]).returning();

  // Contact Variables
  await db.insert(contactVariablesTable).values([
    { name: "first_name", description: "Patient first name", mandatory: true, system: true },
    { name: "last_name", description: "Patient last name", mandatory: true, system: true },
    { name: "mobile", description: "Mobile number (10 digits)", mandatory: true, system: true },
    { name: "uhid", description: "Unique Health ID from HIS", mandatory: false, system: true },
    { name: "specialization", description: "Medical specialization of interest", mandatory: false, system: false },
    { name: "doctor_name", description: "Treating doctor name", mandatory: false, system: false },
    { name: "appointment_date", description: "Appointment date and time", mandatory: false, system: false },
    { name: "balance_due", description: "Outstanding payment amount", mandatory: false, system: false },
    { name: "preferred_language", description: "Language preference (EN/HI/KN/TA)", mandatory: false, system: false },
  ]);

  // Templates — 12 approved (4 SMS, 4 WhatsApp, 4 Push) + mixed languages
  const [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14] = await db.insert(templatesTable).values([
    // SMS (4): 2 Promo, 1 Reminder, 1 Feedback
    {
      name: "Appointment Reminder (SMS)",
      channel: "sms",
      goal: "Appointment Reminder",
      language: "English",
      body: "Dear {first_name}, your appointment with {doctor_name} is on {appointment_date} at Sunrise Hospital. Please arrive 15 min early. Helpline: 080-4567-8901. Reply STOP to opt-out.",
      dltRegisteredBody: "Dear {first_name}, your appointment with {doctor_name} is on {appointment_date} at Sunrise Hospital. Please arrive 15 min early. Helpline: 080-4567-8901. Reply STOP to opt-out.",
      status: "approved",
      scope: "global",
      senderId: "SUNRSE",
      perMessageCost: "0.18",
    },
    {
      name: "Cardiac Health Camp (SMS)",
      channel: "sms",
      goal: "Promotional",
      language: "English",
      body: "FREE Cardiac Screening at Sunrise Hospital on 20 Jun. ECG + Echo at no cost. Limited slots – register at 080-4567-8901. Reply STOP to opt-out.",
      dltRegisteredBody: "FREE Cardiac Screening at Sunrise Hospital on 20 Jun. ECG + Echo at no cost. Limited slots – register at 080-4567-8901. Reply STOP to opt-out.",
      status: "approved",
      scope: "global",
      senderId: "SUNRSE",
      perMessageCost: "0.18",
    },
    {
      name: "Wellness Camp – Promotional (SMS)",
      channel: "sms",
      goal: "Promotional",
      language: "Hindi",
      body: "Sunrise Hospital mein FREE Wellness Camp, 25 Jul. Diabetes, BP, Eye checkup sabhi FREE. Register karein: 080-4567-8901. STOP karein opt-out ke liye.",
      dltRegisteredBody: "Sunrise Hospital mein FREE Wellness Camp, 25 Jul. Diabetes, BP, Eye checkup sabhi FREE. Register karein: 080-4567-8901. STOP karein opt-out ke liye.",
      status: "approved",
      scope: "hospital",
      senderId: "SUNRSE",
      perMessageCost: "0.18",
    },
    {
      // DLT body mismatch — for compliance gate demo
      name: "Diabetes Follow-up Feedback (SMS)",
      channel: "sms",
      goal: "Feedback",
      language: "English",
      body: "Hi {first_name}, how was your recent visit to Sunrise Hospital? Your feedback helps us improve. Reply 1–5 to rate, or call 080-4567-8901. Reply STOP to opt-out.",
      dltRegisteredBody: "MISMATCH_BODY — triggers DLT compliance hard-block for demo",
      status: "approved",
      scope: "hospital",
      senderId: "SUNRSE",
      perMessageCost: "0.18",
    },
    // WhatsApp (4): 2 Appt Reminder, 1 Win-back, 1 Chronic Care
    {
      name: "Appointment Booking Confirmation (WhatsApp)",
      channel: "whatsapp",
      goal: "Appointment Reminder",
      language: "English",
      body: "Dear {first_name},\n\nYour appointment at *Sunrise Multispecialty Hospital* is confirmed!\n\n📅 Date & Time: {appointment_date}\n👨‍⚕️ Doctor: {doctor_name}\n🏥 Dept: {specialization}\n\nPlease carry a valid photo ID and any previous reports.\n\nTo reschedule, call 080-4567-8901.",
      status: "approved",
      scope: "global",
      metaStatus: "APPROVED",
      qualityRating: "Green",
      wabaContact: "+918045678901",
      perMessageCost: "0.65",
    },
    {
      name: "Appointment Reminder 24h (WhatsApp)",
      channel: "whatsapp",
      goal: "Appointment Reminder",
      language: "English",
      body: "Hello {first_name} 👋\n\nThis is a friendly reminder — your appointment at *Sunrise Hospital* is *tomorrow*.\n\n📅 {appointment_date}\n👨‍⚕️ {doctor_name}\n\nPlease arrive 10 minutes early. Bring any prior test reports.\n\nNeed to reschedule? Call us at 080-4567-8901.",
      status: "approved",
      scope: "global",
      metaStatus: "APPROVED",
      qualityRating: "Green",
      wabaContact: "+918045678901",
      perMessageCost: "0.65",
    },
    {
      name: "Win-back – Lapsed Patients (WhatsApp)",
      channel: "whatsapp",
      goal: "Win-back",
      language: "English",
      body: "Hi {first_name} 🙏\n\nWe noticed it's been a while since your last visit to *Sunrise Hospital*. Your health matters to us!\n\nBook a quick check-up today — our doctors are available Mon–Sat.\n\nCall: 080-4567-8901 or visit sunrisehospital.in\n\nReply STOP to opt-out.",
      status: "approved",
      scope: "global",
      // Red quality — for Meta hard-block demo
      metaStatus: "APPROVED",
      qualityRating: "Red",
      wabaContact: "+918045678901",
      perMessageCost: "0.65",
    },
    {
      name: "Post-Op Care Reminder (WhatsApp)",
      channel: "whatsapp",
      goal: "Chronic Care",
      language: "English",
      body: "Hello {first_name} 🙏\n\nThis is a reminder from *Sunrise Hospital* for your post-operative care:\n\n• Take prescribed medications on time\n• Avoid strenuous activity for 2 weeks\n• Follow-up: {appointment_date}\n\nAny concerns? Reply to this message or call 080-4567-8901.",
      status: "approved",
      scope: "global",
      metaStatus: "APPROVED",
      qualityRating: "Green",
      wabaContact: "+918045678901",
      perMessageCost: "0.65",
    },
    // Push (4): Promo, Reminder, Chronic Care, Feedback
    {
      name: "Health Tip – Push",
      channel: "push",
      goal: "Chronic Care",
      language: "English",
      body: "Your weekly health tip 💧 Stay hydrated! Drink at least 8 glasses of water daily to support your recovery and overall wellbeing.",
      status: "approved",
      scope: "global",
      perMessageCost: "0.04",
    },
    {
      name: "Wellness Camp Promo – Push",
      channel: "push",
      goal: "Promotional",
      language: "English",
      body: "🎉 FREE Wellness Camp this Saturday at Sunrise Hospital! Free BP, Diabetes & Eye screening. Limited slots. Tap to register now.",
      status: "approved",
      scope: "global",
      perMessageCost: "0.04",
    },
    {
      name: "Appointment Reminder – Push",
      channel: "push",
      goal: "Appointment Reminder",
      language: "English",
      body: "⏰ Reminder: Your appointment with {doctor_name} is tomorrow at {appointment_date}. Please arrive 10 mins early. Tap for details.",
      status: "approved",
      scope: "hospital",
      perMessageCost: "0.04",
    },
    {
      name: "Post-Visit Feedback – Push",
      channel: "push",
      goal: "Feedback",
      language: "Tamil",
      body: "நல்வாழ்த்துக்கள் {first_name}! Sunrise Hospital வருகை தந்தமைக்கு நன்றி. உங்கள் கருத்தை பகிர்ந்துகொள்ளுங்கள். Tap to rate your visit.",
      status: "approved",
      scope: "hospital",
      perMessageCost: "0.04",
    },
    // Extra: Hindi WA for language diversity
    {
      name: "Diabetes Camp – WhatsApp (Hindi)",
      channel: "whatsapp",
      goal: "Chronic Care",
      language: "Hindi",
      body: "Namaste {first_name} 🙏\n\n*Sunrise Hospital* mein aapko yaad kar rahe hain. Aapka HbA1c test due hai. Jaldi booking karein.\n\n📞 080-4567-8901\n\nOpt-out ke liye STOP reply karein.",
      status: "approved",
      scope: "hospital",
      metaStatus: "APPROVED",
      qualityRating: "Green",
      wabaContact: "+918045678901",
      perMessageCost: "0.65",
    },
    // Kept for backwards-compat with existing campaign seed
    {
      name: "Feedback Request (WhatsApp)",
      channel: "whatsapp",
      goal: "Feedback",
      language: "English",
      body: "Hi {first_name}, thank you for visiting *Sunrise Hospital*. We value your feedback!\n\nPlease rate your experience (1–5) ⭐\nReply with your rating and any comments.\n\nYour feedback helps us serve you better. 🙏",
      status: "approved",
      scope: "global",
      metaStatus: "APPROVED",
      qualityRating: "Yellow",
      wabaContact: "+918045678901",
      perMessageCost: "0.65",
    },
  ]).returning();

  // Template Requests — 3 pending across stages: Push (ap_marketing), SMS DLT (channel_compliance), WA Meta (channel_compliance)
  await db.insert(templateRequestsTable).values([
    {
      name: "Diabetes Awareness Push Notification",
      channel: "push",
      message: "🩺 World Diabetes Day special: Free HbA1c test at Sunrise Hospital this week. Book your slot now — tap to register. Limited availability.",
      goal: "Chronic Care",
      variables: "none",
      approvalStage: "ap_marketing",
      createdBy: String(u1.id),
      rejectionReason: null,
    },
    {
      name: "Monsoon Health Camp – Hindi (SMS)",
      channel: "sms",
      message: "Monsoon Swasthya Camp – Sunrise Hospital mein FREE OPD, 15 Jul se 20 Jul. {first_name}, aaj hi register karein: 080-4567-8901. STOP reply karein opt-out ke liye.",
      goal: "Promotional",
      variables: "first_name",
      approvalStage: "channel_compliance",
      createdBy: String(u1.id),
      rejectionReason: null,
    },
    {
      name: "Paediatric Vaccination Reminder (WhatsApp)",
      channel: "whatsapp",
      message: "Dear {first_name}, your child's {vaccination_name} vaccination is due on {due_date}. Please visit Sunrise Hospital Paediatrics. Questions? Reply here.",
      goal: "Chronic Care",
      variables: "vaccination_name, due_date",
      approvalStage: "channel_compliance",
      createdBy: String(u2.id),
      rejectionReason: null,
    },
  ]);

  // Leads across channels
  const leadsData = [
    // WhatsApp active sessions
    { firstName: "Arjun", lastName: "Verma", mobile: "9876543210", specialization: "Cardiology", sourceChannel: "waba" as const, status: "in_progress" as const, ownerUserId: u1.id, hasActiveSession: true, sessionExpiresAt: new Date(Date.now() + 20 * 3600 * 1000) },
    { firstName: "Sunita", lastName: "Rao", mobile: "9845612378", specialization: "Gynaecology", sourceChannel: "waba" as const, status: "contacted" as const, ownerUserId: u1.id, hasActiveSession: true, sessionExpiresAt: new Date(Date.now() + 18 * 3600 * 1000) },
    { firstName: "Deepak", lastName: "Kumar", mobile: "9900123456", specialization: "Neurology", sourceChannel: "waba" as const, status: "new" as const, hasActiveSession: true, sessionExpiresAt: new Date(Date.now() + 22 * 3600 * 1000) },
    // Web chat
    { firstName: "Lakshmi", lastName: "Narayanan", mobile: "9845500123", specialization: "Cardiology", sourceChannel: "web_chat" as const, status: "in_progress" as const, ownerUserId: u1.id, hasActiveSession: true, sessionExpiresAt: new Date(Date.now() + 14 * 3600 * 1000) },
    { firstName: "Prashant", lastName: "Joshi", mobile: "9741234567", specialization: "Orthopedics", sourceChannel: "web_chat" as const, status: "new" as const, hasActiveSession: true, sessionExpiresAt: new Date(Date.now() + 21 * 3600 * 1000) },
    // Form leads
    { firstName: "Meghna", lastName: "Pillai", mobile: "9800234567", specialization: "Gynaecology", sourceChannel: "form" as const, status: "new" as const, optedIn: true },
    { firstName: "Vikram", lastName: "Singh", mobile: "9811234567", specialization: "General Medicine", sourceChannel: "form" as const, status: "contacted" as const, ownerUserId: u1.id },
    { firstName: "Rekha", lastName: "Menon", mobile: "9822334567", specialization: "Neurology", sourceChannel: "form" as const, status: "fulfilled" as const, ownerUserId: u2.id },
    { firstName: "Suresh", lastName: "Babu", mobile: "9833434567", specialization: "Cardiology", sourceChannel: "form" as const, status: "closed" as const },
    { firstName: "Anitha", lastName: "Krishnamurthy", mobile: "9844534567", specialization: "Dermatology", sourceChannel: "form" as const, status: "new" as const },
    // CSV leads
    { firstName: "Mohammed", lastName: "Farouk", mobile: "9755123456", uhid: "UHID-00234", specialization: "Orthopedics", sourceChannel: "csv" as const, status: "new" as const, sourceListTag: "Q1-Ortho-Followup" },
    { firstName: "Geeta", lastName: "Nair", mobile: "9766223456", uhid: "UHID-00891", specialization: "Cardiology", sourceChannel: "csv" as const, status: "contacted" as const, ownerUserId: u2.id, sourceListTag: "Q1-Ortho-Followup" },
    { firstName: "Ranjit", lastName: "Patel", mobile: "9777323456", uhid: "UHID-01234", specialization: "Gastroenterology", sourceChannel: "csv" as const, status: "in_progress" as const, ownerUserId: u1.id, sourceListTag: "Cardio-May" },
    { firstName: "Lalitha", lastName: "Subramanian", mobile: "9788423456", uhid: "UHID-02345", specialization: "Gynaecology", sourceChannel: "csv" as const, status: "fulfilled" as const, ownerUserId: u2.id, sourceListTag: "Cardio-May" },
    { firstName: "Ajay", lastName: "Thakkar", mobile: "9799523456", uhid: "UHID-03456", specialization: "Urology", sourceChannel: "csv" as const, status: "new" as const, dndListed: true, sourceListTag: "Neuro-WinBack" },
    // App/Web Bookings
    { firstName: "Shobha", lastName: "Gupta", mobile: "9600123456", specialization: "Cardiology", sourceChannel: "app_booking" as const, status: "fulfilled" as const, uhid: "UHID-10001" },
    { firstName: "Dinesh", lastName: "Acharya", mobile: "9611223456", specialization: "Orthopedics", sourceChannel: "app_booking" as const, status: "fulfilled" as const, uhid: "UHID-10002" },
    { firstName: "Usha", lastName: "Bhat", mobile: "9622323456", specialization: "Gynaecology", sourceChannel: "web_booking" as const, status: "fulfilled" as const, uhid: "UHID-10003" },
    { firstName: "Nagesh", lastName: "Shetty", mobile: "9633423456", specialization: "Neurology", sourceChannel: "web_booking" as const, status: "in_progress" as const },
    { firstName: "Padma", lastName: "Venkatesh", mobile: "9644523456", specialization: "Paediatrics", sourceChannel: "web_booking" as const, status: "new" as const },
    // Email leads
    { firstName: "Rohit", lastName: "Malhotra", mobile: "9500123456", email: "rohit.malhotra@gmail.com", specialization: "Cardiology", sourceChannel: "email" as const, status: "new" as const, ownerUserId: u1.id },
    { firstName: "Kavya", lastName: "Hegde", mobile: "9511223456", email: "kavya.hegde@outlook.com", specialization: "Dermatology", sourceChannel: "email" as const, status: "contacted" as const, ownerUserId: u1.id },
    { firstName: "Santosh", lastName: "Kulkarni", mobile: "9522323456", email: "santosh.k@company.in", specialization: "General Medicine", sourceChannel: "email" as const, status: "in_progress" as const, ownerUserId: u2.id },
    // Medicine order leads
    { firstName: "Hema", lastName: "Naidu", mobile: "9533423456", specialization: "Oncology", sourceChannel: "medicine_order" as const, status: "in_progress" as const, ownerUserId: u2.id, uhid: "UHID-MO001", moduleStage: "processing" },
    { firstName: "Prasad", lastName: "Rao", mobile: "9544523456", specialization: "Gastroenterology", sourceChannel: "medicine_order" as const, status: "fulfilled" as const, uhid: "UHID-MO002", moduleStage: "delivered" },
    // Lab test leads
    { firstName: "Nalini", lastName: "Subramaniam", mobile: "9555623456", specialization: "Cardiology", sourceChannel: "lab_test" as const, status: "new" as const, uhid: "UHID-LT001", moduleStage: "sample_collected" },
    { firstName: "Bharath", lastName: "Krishnamurthy", mobile: "9566723456", specialization: "General Medicine", sourceChannel: "lab_test" as const, status: "in_progress" as const, ownerUserId: u1.id, uhid: "UHID-LT002", moduleStage: "processing" },
    // Web appointment leads
    { firstName: "Sarita", lastName: "Jain", mobile: "9577823456", specialization: "Gynaecology", sourceChannel: "web_appointment" as const, status: "contacted" as const, ownerUserId: u1.id, uhid: "UHID-WA001", moduleStage: "scheduled" },
    { firstName: "Kiran", lastName: "Reddy", mobile: "9588923456", specialization: "Orthopedics", sourceChannel: "web_appointment" as const, status: "fulfilled" as const, ownerUserId: u2.id, uhid: "UHID-WA002", moduleStage: "visited" },
    // App appointment leads
    { firstName: "Divya", lastName: "Menon", mobile: "9599023456", specialization: "Paediatrics", sourceChannel: "app_appointment" as const, status: "new" as const, uhid: "UHID-AA001", moduleStage: "scheduled" },
    { firstName: "Sudhir", lastName: "Pillai", mobile: "9610123456", specialization: "Neurology", sourceChannel: "app_appointment" as const, status: "in_progress" as const, ownerUserId: u2.id, uhid: "UHID-AA002", moduleStage: "confirmed" },

    // ── EXTRA LEADS for rich dashboard data ──────────────────────────────────
    // SLA Critical: >72 h, new, unactioned  (indices 31-36)
    { firstName: "Sanjay",   lastName: "Mehta",        mobile: "9870001001", specialization: "Cardiology",       sourceChannel: "waba"          as const, status: "new" as const, _hoursAgo: 96  },
    { firstName: "Preethi",  lastName: "Rajan",        mobile: "9870001002", specialization: "Orthopedics",      sourceChannel: "form"          as const, status: "new" as const, _hoursAgo: 120 },
    { firstName: "Venkat",   lastName: "Subash",       mobile: "9870001003", specialization: "Neurology",        sourceChannel: "csv"           as const, status: "new" as const, _hoursAgo: 84, sourceListTag: "Neuro-WinBack" },
    { firstName: "Asha",     lastName: "Krishnan",     mobile: "9870001004", specialization: "General Medicine", sourceChannel: "web_chat"      as const, status: "new" as const, _hoursAgo: 108 },
    { firstName: "Ramesh",   lastName: "Pillai",       mobile: "9870001005", specialization: "Gynaecology",      sourceChannel: "email"         as const, status: "new" as const, _hoursAgo: 78  },
    { firstName: "Nirmala",  lastName: "Iyer",         mobile: "9870001006", specialization: "Oncology",         sourceChannel: "app_booking"   as const, status: "new" as const, _hoursAgo: 144 },

    // SLA At-risk: 24-72 h, new  (indices 37-44)
    { firstName: "Siddharth",lastName: "Bose",         mobile: "9870001007", specialization: "Cardiology",       sourceChannel: "web_booking"   as const, status: "new" as const, _hoursAgo: 36 },
    { firstName: "Kavita",   lastName: "Shah",         mobile: "9870001008", specialization: "Dermatology",      sourceChannel: "form"          as const, status: "new" as const, _hoursAgo: 48 },
    { firstName: "Thirumalai",lastName:"Krishnan",     mobile: "9870001009", specialization: "Urology",          sourceChannel: "csv"           as const, status: "new" as const, _hoursAgo: 60, sourceListTag: "Neuro-WinBack" },
    { firstName: "Manjula",  lastName: "Pai",          mobile: "9870001010", specialization: "Paediatrics",      sourceChannel: "waba"          as const, status: "new" as const, _hoursAgo: 30 },
    { firstName: "Prashanth",lastName: "Nair",         mobile: "9870001011", specialization: "Cardiology",       sourceChannel: "web_chat"      as const, status: "new" as const, _hoursAgo: 54 },
    { firstName: "Saroja",   lastName: "Devi",         mobile: "9870001012", specialization: "Neurology",        sourceChannel: "form"          as const, status: "new" as const, _hoursAgo: 42 },
    { firstName: "Arun",     lastName: "Kapoor",       mobile: "9870001013", specialization: "General Medicine", sourceChannel: "email"         as const, status: "new" as const, _hoursAgo: 27 },
    { firstName: "Rohini",   lastName: "Verma",        mobile: "9870001014", specialization: "Gynaecology",      sourceChannel: "web_booking"   as const, status: "new" as const, _hoursAgo: 66 },

    // Watching: 6-24 h, new  (indices 45-50)
    { firstName: "Sunil",    lastName: "Patil",        mobile: "9870001015", specialization: "Cardiology",       sourceChannel: "waba"          as const, status: "new" as const, _hoursAgo: 8  },
    { firstName: "Deepika",  lastName: "Nair",         mobile: "9870001016", specialization: "Orthopedics",      sourceChannel: "form"          as const, status: "new" as const, _hoursAgo: 12 },
    { firstName: "Prakash",  lastName: "Hegde",        mobile: "9870001017", specialization: "General Medicine", sourceChannel: "web_chat"      as const, status: "new" as const, _hoursAgo: 18 },
    { firstName: "Amrutha",  lastName: "Singh",        mobile: "9870001018", specialization: "Neurology",        sourceChannel: "csv"           as const, status: "new" as const, _hoursAgo: 10, sourceListTag: "Q1-Ortho-Followup" },
    { firstName: "Dinesh",   lastName: "Rao",          mobile: "9870001019", specialization: "Cardiology",       sourceChannel: "app_booking"   as const, status: "new" as const, _hoursAgo: 20 },
    { firstName: "Swetha",   lastName: "Gowda",        mobile: "9870001020", specialization: "Gynaecology",      sourceChannel: "web_booking"   as const, status: "new" as const, _hoursAgo: 7  },

    // Fresh: <6 h, new  (indices 51-54)
    { firstName: "Vinod",    lastName: "Kumar",        mobile: "9870001021", specialization: "Orthopedics",      sourceChannel: "waba"          as const, status: "new" as const, _hoursAgo: 1 },
    { firstName: "Ratna",    lastName: "Bai",          mobile: "9870001022", specialization: "Cardiology",       sourceChannel: "form"          as const, status: "new" as const, _hoursAgo: 2 },
    { firstName: "Ajith",    lastName: "Thomas",       mobile: "9870001023", specialization: "General Medicine", sourceChannel: "web_chat"      as const, status: "new" as const, _hoursAgo: 3 },
    { firstName: "Pooja",    lastName: "Krishnamurthy",mobile: "9870001024", specialization: "Neurology",        sourceChannel: "email"         as const, status: "new" as const, _hoursAgo: 5 },

    // Contacted (owner assigned, follow-up in progress)  (indices 55-66)
    { firstName: "Madhuri",  lastName: "Desai",        mobile: "9870002001", specialization: "Cardiology",       sourceChannel: "waba"          as const, status: "contacted" as const, ownerUserId: u1.id, _hoursAgo: 52,  _lastActionHoursAgo: 48 },
    { firstName: "Ganesh",   lastName: "Rao",          mobile: "9870002002", specialization: "Orthopedics",      sourceChannel: "form"          as const, status: "contacted" as const, ownerUserId: u1.id, _hoursAgo: 72,  _lastActionHoursAgo: 60 },
    { firstName: "Leela",    lastName: "Krishnaswamy", mobile: "9870002003", specialization: "Gynaecology",      sourceChannel: "csv"           as const, status: "contacted" as const, ownerUserId: u2.id, _hoursAgo: 96,  _lastActionHoursAgo: 80, sourceListTag: "Cardio-May" },
    { firstName: "Balaji",   lastName: "Subramaniam",  mobile: "9870002004", specialization: "Dermatology",      sourceChannel: "email"         as const, status: "contacted" as const, ownerUserId: u1.id, _hoursAgo: 40,  _lastActionHoursAgo: 30 },
    { firstName: "Sudha",    lastName: "Rao",          mobile: "9870002005", specialization: "General Medicine", sourceChannel: "web_chat"      as const, status: "contacted" as const, ownerUserId: u2.id, _hoursAgo: 120, _lastActionHoursAgo: 100 },
    { firstName: "Pradeep",  lastName: "Nambiar",      mobile: "9870002006", specialization: "Neurology",        sourceChannel: "web_booking"   as const, status: "contacted" as const, ownerUserId: u1.id, _hoursAgo: 60,  _lastActionHoursAgo: 55 },
    { firstName: "Usha",     lastName: "Kumari",       mobile: "9870002007", specialization: "Paediatrics",      sourceChannel: "app_booking"   as const, status: "contacted" as const, ownerUserId: u2.id, _hoursAgo: 28,  _lastActionHoursAgo: 24 },
    { firstName: "Santanu",  lastName: "Ghosh",        mobile: "9870002008", specialization: "Gastroenterology", sourceChannel: "email"         as const, status: "contacted" as const, ownerUserId: u2.id, _hoursAgo: 84,  _lastActionHoursAgo: 72 },
    { firstName: "Meenakshi",lastName: "Sundaram",     mobile: "9870002009", specialization: "Cardiology",       sourceChannel: "waba"          as const, status: "contacted" as const, ownerUserId: u1.id, _hoursAgo: 36,  _lastActionHoursAgo: 30 },
    { firstName: "Harish",   lastName: "Bhat",         mobile: "9870002010", specialization: "Urology",          sourceChannel: "csv"           as const, status: "contacted" as const, ownerUserId: u1.id, _hoursAgo: 48,  _lastActionHoursAgo: 40, sourceListTag: "Q1-Ortho-Followup" },
    { firstName: "Vijaya",   lastName: "Lakshmi",      mobile: "9870002011", specialization: "Oncology",         sourceChannel: "web_booking"   as const, status: "contacted" as const, ownerUserId: u2.id, _hoursAgo: 56,  _lastActionHoursAgo: 50 },
    { firstName: "Naresh",   lastName: "Reddy",        mobile: "9870002012", specialization: "Orthopedics",      sourceChannel: "waba"          as const, status: "contacted" as const, ownerUserId: u1.id, _hoursAgo: 68,  _lastActionHoursAgo: 60 },

    // In Progress  (indices 67-76)
    { firstName: "Ramya",    lastName: "Nair",         mobile: "9870003001", specialization: "Cardiology",       sourceChannel: "web_chat"      as const, status: "in_progress" as const, ownerUserId: u1.id, _hoursAgo: 144, _lastActionHoursAgo: 2  },
    { firstName: "Karthik",  lastName: "Srinivasan",   mobile: "9870003002", specialization: "Orthopedics",      sourceChannel: "waba"          as const, status: "in_progress" as const, ownerUserId: u2.id, _hoursAgo: 216, _lastActionHoursAgo: 5  },
    { firstName: "Anupama",  lastName: "Sharma",       mobile: "9870003003", specialization: "Gynaecology",      sourceChannel: "form"          as const, status: "in_progress" as const, ownerUserId: u1.id, _hoursAgo: 72,  _lastActionHoursAgo: 1  },
    { firstName: "Sriram",   lastName: "Venkatesh",    mobile: "9870003004", specialization: "Neurology",        sourceChannel: "csv"           as const, status: "in_progress" as const, ownerUserId: u2.id, _hoursAgo: 168, _lastActionHoursAgo: 6, sourceListTag: "Neuro-WinBack" },
    { firstName: "Bhavana",  lastName: "Krishnan",     mobile: "9870003005", specialization: "Dermatology",      sourceChannel: "email"         as const, status: "in_progress" as const, ownerUserId: u1.id, _hoursAgo: 96,  _lastActionHoursAgo: 3  },
    { firstName: "Suresh",   lastName: "Chandran",     mobile: "9870003006", specialization: "Cardiology",       sourceChannel: "app_booking"   as const, status: "in_progress" as const, ownerUserId: u2.id, _hoursAgo: 120, _lastActionHoursAgo: 4  },
    { firstName: "Lakshmi",  lastName: "Prasad",       mobile: "9870003007", specialization: "General Medicine", sourceChannel: "web_booking"   as const, status: "in_progress" as const, ownerUserId: u1.id, _hoursAgo: 48,  _lastActionHoursAgo: 2  },
    { firstName: "Manoj",    lastName: "Pillai",       mobile: "9870003008", specialization: "Gastroenterology", sourceChannel: "waba"          as const, status: "in_progress" as const, ownerUserId: u2.id, _hoursAgo: 192, _lastActionHoursAgo: 8  },
    { firstName: "Radha",    lastName: "Krishnaswamy", mobile: "9870003009", specialization: "Cardiology",       sourceChannel: "form"          as const, status: "in_progress" as const, ownerUserId: u1.id, _hoursAgo: 60,  _lastActionHoursAgo: 1  },
    { firstName: "Vikram",   lastName: "Nambiar",      mobile: "9870003010", specialization: "Paediatrics",      sourceChannel: "email"         as const, status: "in_progress" as const, ownerUserId: u2.id, _hoursAgo: 80,  _lastActionHoursAgo: 3  },

    // Fulfilled (recent conversions — big pool for CRM conversion metrics)  (indices 77-91)
    { firstName: "Anand",    lastName: "Subramaniam",  mobile: "9870004001", specialization: "Cardiology",       sourceChannel: "waba"          as const, status: "fulfilled" as const, ownerUserId: u1.id, _hoursAgo: 48  },
    { firstName: "Lata",     lastName: "Mangeshkar",   mobile: "9870004002", specialization: "Orthopedics",      sourceChannel: "form"          as const, status: "fulfilled" as const, ownerUserId: u2.id, _hoursAgo: 72  },
    { firstName: "Girish",   lastName: "Karnad",       mobile: "9870004003", specialization: "Neurology",        sourceChannel: "csv"           as const, status: "fulfilled" as const, ownerUserId: u1.id, _hoursAgo: 96,  sourceListTag: "Cardio-May" },
    { firstName: "Smitha",   lastName: "Patil",        mobile: "9870004004", specialization: "Gynaecology",      sourceChannel: "web_chat"      as const, status: "fulfilled" as const, ownerUserId: u2.id, _hoursAgo: 120 },
    { firstName: "Prasad",   lastName: "Naik",         mobile: "9870004005", specialization: "General Medicine", sourceChannel: "app_booking"   as const, status: "fulfilled" as const, ownerUserId: u1.id, _hoursAgo: 36  },
    { firstName: "Kaveri",   lastName: "Deshpande",    mobile: "9870004006", specialization: "Cardiology",       sourceChannel: "web_booking"   as const, status: "fulfilled" as const, ownerUserId: u1.id, _hoursAgo: 168 },
    { firstName: "Suresh",   lastName: "Prabhu",       mobile: "9870004007", specialization: "Dermatology",      sourceChannel: "email"         as const, status: "fulfilled" as const, ownerUserId: u2.id, _hoursAgo: 144 },
    { firstName: "Deepa",    lastName: "Menon",        mobile: "9870004008", specialization: "Oncology",         sourceChannel: "form"          as const, status: "fulfilled" as const, ownerUserId: u2.id, _hoursAgo: 192 },
    { firstName: "Rajendra", lastName: "Prasad",       mobile: "9870004009", specialization: "Orthopedics",      sourceChannel: "waba"          as const, status: "fulfilled" as const, ownerUserId: u1.id, _hoursAgo: 240 },
    { firstName: "Girija",   lastName: "Devi",         mobile: "9870004010", specialization: "Paediatrics",      sourceChannel: "web_chat"      as const, status: "fulfilled" as const, ownerUserId: u2.id, _hoursAgo: 288 },
    { firstName: "Ramachandran",lastName:"Iyer",       mobile: "9870004011", specialization: "Urology",          sourceChannel: "csv"           as const, status: "fulfilled" as const, ownerUserId: u1.id, _hoursAgo: 336, sourceListTag: "Q1-Ortho-Followup" },
    { firstName: "Padmaja",  lastName: "Rao",          mobile: "9870004012", specialization: "Cardiology",       sourceChannel: "app_booking"   as const, status: "fulfilled" as const, ownerUserId: u2.id, _hoursAgo: 60  },
    { firstName: "Sundar",   lastName: "Rajan",        mobile: "9870004013", specialization: "Gastroenterology", sourceChannel: "web_booking"   as const, status: "fulfilled" as const, ownerUserId: u1.id, _hoursAgo: 80  },
    { firstName: "Mythili",  lastName: "Krishnan",     mobile: "9870004014", specialization: "Gynaecology",      sourceChannel: "email"         as const, status: "fulfilled" as const, ownerUserId: u2.id, _hoursAgo: 110 },
    { firstName: "Shankar",  lastName: "Mahadevan",    mobile: "9870004015", specialization: "Cardiology",       sourceChannel: "waba"          as const, status: "fulfilled" as const, ownerUserId: u1.id, _hoursAgo: 130 },

    // Closed  (indices 92-96)
    { firstName: "Balu",     lastName: "Narayanan",    mobile: "9870005001", specialization: "Cardiology",       sourceChannel: "form"          as const, status: "closed"    as const, _hoursAgo: 360 },
    { firstName: "Kamala",   lastName: "Devi",         mobile: "9870005002", specialization: "Orthopedics",      sourceChannel: "csv"           as const, status: "closed"    as const, _hoursAgo: 480, sourceListTag: "Neuro-WinBack" },
    { firstName: "Prabhu",   lastName: "Shankar",      mobile: "9870005003", specialization: "Neurology",        sourceChannel: "web_chat"      as const, status: "closed"    as const, _hoursAgo: 504 },
    { firstName: "Indira",   lastName: "Gandhi",       mobile: "9870005004", specialization: "General Medicine", sourceChannel: "email"         as const, status: "closed"    as const, _hoursAgo: 600 },
    { firstName: "Subramani",lastName: "Swamy",        mobile: "9870005005", specialization: "Gastroenterology", sourceChannel: "app_booking"   as const, status: "closed"    as const, _hoursAgo: 720 },
  ];

  // Offset createdAt for realistic dates
  const now = Date.now();
  const insertedLeads = await Promise.all(leadsData.map(async (ld) => {
    const { _hoursAgo, _lastActionHoursAgo, ...leadFields } = ld as any;
    const createdMs  = _hoursAgo != null
      ? (_hoursAgo as number) * 3600 * 1000
      : Math.floor(Math.random() * 28 + 1) * 24 * 3600 * 1000;
    const lastActMs  = _lastActionHoursAgo != null
      ? (_lastActionHoursAgo as number) * 3600 * 1000
      : (_hoursAgo != null ? createdMs : Math.floor(Math.random() * 5) * 24 * 3600 * 1000);
    const [lead] = await db.insert(leadsTable).values({
      ...leadFields,
      optedIn: leadFields.optedIn !== undefined ? leadFields.optedIn : true,
      hasActiveSession: leadFields.hasActiveSession ?? false,
      createdAt:    new Date(now - createdMs),
      lastActionAt: new Date(now - Math.min(lastActMs, createdMs)),
    }).returning();
    await db.insert(activityLogTable).values({
      leadId: lead.id,
      type: "created",
      description: `Lead created via ${lead.sourceChannel}`,
      userId: null,
      createdAt: new Date(now - createdMs),
    });
    return lead;
  }));

  // Rich chat threads for waba/web_chat leads
  // leads[0] = Arjun Verma (waba, in_progress) — multi-turn thread, session open
  const arjun = insertedLeads[0];
  await db.insert(messagesTable).values([
    { leadId: arjun.id, direction: "in", body: "Hello, I have been having chest pain for the last two days. Can I see a cardiologist?", channel: "waba", status: "received", timestamp: new Date(now - 5 * 3600 * 1000) },
    { leadId: arjun.id, direction: "out", body: "Dear Arjun,\n\nThank you for reaching out to Sunrise Hospital. We take chest pain very seriously. Dr. Ananya Krishnan (Cardiology) has availability this week. Shall I check slots for you?", channel: "waba", templateId: t6.id, status: "read", timestamp: new Date(now - 4.5 * 3600 * 1000) },
    { leadId: arjun.id, direction: "in", body: "Yes please! Preferably morning slots. Also is this covered under cashless insurance?", channel: "waba", status: "received", timestamp: new Date(now - 4 * 3600 * 1000) },
    { leadId: arjun.id, direction: "out", body: "Dr. Krishnan is available Monday 10 AM or Wednesday 11 AM. Both are morning slots.\n\nFor insurance, we accept most cashless policies. Please bring your TPA card and policy number. Our billing desk can verify on the day.", channel: "waba", status: "read", timestamp: new Date(now - 3.5 * 3600 * 1000) },
    { leadId: arjun.id, direction: "in", body: "Monday 10 AM works. My policy is from Star Health. Please confirm the appointment.", channel: "waba", status: "received", timestamp: new Date(now - 3 * 3600 * 1000) },
    { leadId: arjun.id, direction: "out", body: "Your appointment with Dr. Ananya Krishnan is confirmed for Monday at 10:00 AM.\n\n📅 Date: Mon, 16 Jun 2026\n👨‍⚕️ Doctor: Dr. Ananya Krishnan\n🏥 Dept: Cardiology\n\nPlease arrive 15 minutes early. Bring your previous ECG/Echo reports if any. Star Health cashless is accepted — carry your TPA card.", channel: "waba", templateId: t6.id, status: "read", timestamp: new Date(now - 2.5 * 3600 * 1000) },
    { leadId: arjun.id, direction: "in", body: "Thank you so much! Will do.", channel: "waba", status: "received", timestamp: new Date(now - 30 * 60 * 1000) },
  ]);
  await db.insert(activityLogTable).values([
    { leadId: arjun.id, type: "message_received", description: "Patient messaged: chest pain, requesting cardiology consultation", userId: null, createdAt: new Date(now - 5 * 3600 * 1000) },
    { leadId: arjun.id, type: "template_sent", description: "Template sent: Appointment Booking Confirmation (WhatsApp)", userId: u1.id, createdAt: new Date(now - 4.5 * 3600 * 1000) },
    { leadId: arjun.id, type: "status_change", description: "Status changed from new → in_progress", userId: u1.id, createdAt: new Date(now - 4 * 3600 * 1000) },
    { leadId: arjun.id, type: "message_received", description: "Patient confirmed Monday 10 AM appointment", userId: null, createdAt: new Date(now - 3 * 3600 * 1000) },
  ]);

  // leads[1] = Sunita Rao (waba, contacted) — thread with 4 messages
  const sunita = insertedLeads[1];
  await db.insert(messagesTable).values([
    { leadId: sunita.id, direction: "in", body: "Hi, I want to know about gynaecology OPD. I'm 28 weeks pregnant.", channel: "waba", status: "received", timestamp: new Date(now - 8 * 3600 * 1000) },
    { leadId: sunita.id, direction: "out", body: "Hello Sunita 🙏\n\nCongratulations! Dr. Kavitha Reddy (Gynaecology & Obstetrics) handles high-risk and normal pregnancies. She is available Tuesday 9 AM–1 PM.\n\nShall I book a slot for you?", channel: "waba", status: "read", timestamp: new Date(now - 7.5 * 3600 * 1000) },
    { leadId: sunita.id, direction: "in", body: "Yes please. Tuesday 11 AM would be perfect. Do I need to bring any reports?", channel: "waba", status: "received", timestamp: new Date(now - 7 * 3600 * 1000) },
    { leadId: sunita.id, direction: "out", body: "Tuesday 11 AM with Dr. Kavitha Reddy is confirmed ✅\n\nPlease bring:\n• Previous USG reports\n• Blood test reports (CBC, blood sugar)\n• Vaccination records\n\nFor any urgent queries call 080-4567-8901.", channel: "waba", templateId: t6.id, status: "delivered", timestamp: new Date(now - 6.5 * 3600 * 1000) },
  ]);

  // leads[2] = Deepak Kumar (waba, new) — UNREAD: recent inbound with no reply
  const deepak = insertedLeads[2];
  await db.insert(messagesTable).values([
    { leadId: deepak.id, direction: "in", body: "I've been getting severe headaches and dizziness for a week. My GP referred me to a neurologist. Is Dr. Meera Pillai available?", channel: "waba", status: "received", timestamp: new Date(now - 45 * 60 * 1000) },
  ]);

  // leads[3] = Lakshmi Narayanan (web_chat, in_progress) — active thread
  const lakshmi = insertedLeads[3];
  await db.insert(messagesTable).values([
    { leadId: lakshmi.id, direction: "in", body: "Hello, I saw your website. I need a cardiology checkup. My father had a heart attack last year and I'm concerned about my own risk.", channel: "web_chat", status: "received", timestamp: new Date(now - 6 * 3600 * 1000) },
    { leadId: lakshmi.id, direction: "out", body: "Hello Lakshmi! Thank you for reaching out. A preventive cardiology consultation is a great idea given your family history. Dr. Ananya Krishnan specialises in exactly this. I'll check her slots.", channel: "web_chat", status: "read", timestamp: new Date(now - 5.5 * 3600 * 1000) },
    { leadId: lakshmi.id, direction: "in", body: "Thank you. What tests will she order? I want to be prepared.", channel: "web_chat", status: "received", timestamp: new Date(now - 5 * 3600 * 1000) },
    { leadId: lakshmi.id, direction: "out", body: "For a preventive cardiac assessment, Dr. Krishnan typically orders:\n• ECG (electrocardiogram)\n• 2D Echo\n• Lipid profile (fasting blood test)\n• Blood pressure monitoring\n\nThese are usually done the same day at our diagnostics centre. You'll get results in 2–4 hours.", channel: "web_chat", status: "delivered", timestamp: new Date(now - 4.5 * 3600 * 1000) },
    { leadId: lakshmi.id, direction: "in", body: "That's very helpful. I'm free next Friday. Can I book online?", channel: "web_chat", status: "received", timestamp: new Date(now - 4 * 3600 * 1000) },
    { leadId: lakshmi.id, direction: "out", body: "Absolutely! Friday at 10 AM or 2 PM is available with Dr. Krishnan. Which do you prefer?", channel: "web_chat", status: "sent", timestamp: new Date(now - 3.5 * 3600 * 1000) },
  ]);

  // leads[4] = Prashant Joshi (web_chat, new) — UNREAD: latest inbound just came in
  const prashant = insertedLeads[4];
  await db.insert(messagesTable).values([
    { leadId: prashant.id, direction: "in", body: "Hi! I had a knee injury playing cricket 3 months ago. It still hurts when I climb stairs. Can I see Dr. Ramesh Nair?", channel: "web_chat", status: "received", timestamp: new Date(now - 20 * 60 * 1000) },
  ]);

  // Email threads for email leads (insertedLeads[20-22])
  const rohitEmail = insertedLeads[20];
  if (rohitEmail) {
    await db.insert(messagesTable).values([
      { leadId: rohitEmail.id, direction: "in", body: "Hello,\n\nI have been experiencing occasional chest tightness and shortness of breath over the past 2 weeks. My family physician recommended I see a cardiologist.\n\nCould you please let me know about availability for Dr. Ananya Krishnan? I am based in Koramangala.\n\nThank you,\nRohit Malhotra", subject: "Cardiology Consultation Request", channel: "email", status: "received", timestamp: new Date(now - 3 * 3600 * 1000) },
    ]);
    await db.insert(activityLogTable).values({
      leadId: rohitEmail.id, type: "message_received", description: "Email received: Cardiology Consultation Request", userId: null, createdAt: new Date(now - 3 * 3600 * 1000),
    });
  }

  const kavyaEmail = insertedLeads[21];
  if (kavyaEmail) {
    await db.insert(messagesTable).values([
      { leadId: kavyaEmail.id, direction: "in", body: "Hi,\n\nI visited your hospital last month for a skin rash. Dr. Sunitha had prescribed a topical cream. The rash has partially subsided but I still have itching.\n\nCan I book a follow-up appointment?\n\nRegards,\nKavya Hegde", subject: "Follow-up: Dermatology Visit (Ref: DRM-2024-447)", channel: "email", status: "received", timestamp: new Date(now - 5 * 3600 * 1000) },
      { leadId: kavyaEmail.id, direction: "out", body: "Dear Kavya,\n\nThank you for reaching out. Dr. Sunitha is available this Friday between 10 AM – 1 PM and next Monday 9 AM – 12 PM.\n\nKindly reply with your preferred slot and we will confirm the appointment.\n\nWarm regards,\nPatient Relations – Sunrise Hospital", subject: "Re: Follow-up: Dermatology Visit (Ref: DRM-2024-447)", channel: "email", status: "delivered", timestamp: new Date(now - 4 * 3600 * 1000) },
    ]);
    await db.insert(activityLogTable).values({
      leadId: kavyaEmail.id, type: "assignment", description: "Assigned to Priya Sharma", userId: u1.id, createdAt: new Date(now - 4.5 * 3600 * 1000),
    });
  }

  const santoshEmail = insertedLeads[22];
  if (santoshEmail) {
    await db.insert(messagesTable).values([
      { leadId: santoshEmail.id, direction: "in", body: "Dear Sir/Madam,\n\nI am writing on behalf of Santosh Kulkarni (Employee ID: EMP-3842) to inquire about your corporate health check-up packages.\n\nWe are looking for a package covering blood work, ECG, chest X-ray, and abdominal ultrasound. Could you share your corporate tariff?\n\nBest regards,\nHR Department, Infosys Ltd", subject: "Corporate Health Check-up Enquiry", channel: "email", status: "received", timestamp: new Date(now - 1 * 3600 * 1000) },
      { leadId: santoshEmail.id, direction: "out", body: "Dear HR Team,\n\nThank you for your enquiry. Our Corporate Executive Health Check-up package (₹3,200/person) includes:\n• Complete Blood Count + Lipid profile\n• ECG (12-lead)\n• Chest X-ray (PA view)\n• Ultrasound Abdomen\n• BMI & BP assessment\n• Physician consultation\n\nFor groups of 20+, we offer a 15% discount. Our corporate coordinator Ankit Joshi (+91-80-4567-8910) can arrange a camp at your premises.\n\nKind regards,\nCorporate Health Division, Sunrise Hospital", subject: "Re: Corporate Health Check-up Enquiry", channel: "email", status: "read", timestamp: new Date(now - 30 * 60 * 1000) },
    ]);
    await db.insert(activityLogTable).values([
      { leadId: santoshEmail.id, type: "status_change", description: "Status changed from new → in_progress", userId: u2.id, createdAt: new Date(now - 45 * 60 * 1000) },
      { leadId: santoshEmail.id, type: "assignment", description: "Assigned to Ramesh Iyer", userId: u2.id, createdAt: new Date(now - 45 * 60 * 1000) },
    ]);
  }

  // Add transactionContext for module-driven leads
  const hema = insertedLeads[23]; // medicine_order – processing
  if (hema) {
    await db.update(leadsTable).set({
      transactionContext: { medicines: [{ name: "Capecitabine 500mg", qty: 60, dosage: "Twice daily with food" }, { name: "Ondansetron 4mg", qty: 30, dosage: "As needed for nausea" }], totalAmount: 4820, pharmacy: "Sunrise Pharmacy – Main Block", orderId: "ORD-20240612-7841" },
    }).where(eq(leadsTable.id, hema.id));
    await db.insert(activityLogTable).values({ leadId: hema.id, type: "stage_change", description: "Stage advanced: order_placed → processing", userId: u2.id, createdAt: new Date(now - 2 * 3600 * 1000) });
  }

  const prasad = insertedLeads[24]; // medicine_order – delivered
  if (prasad) {
    await db.update(leadsTable).set({
      transactionContext: { medicines: [{ name: "Pantoprazole 40mg", qty: 30, dosage: "Once daily before breakfast" }, { name: "Domperidone 10mg", qty: 30, dosage: "Twice daily before meals" }], totalAmount: 680, pharmacy: "Sunrise Pharmacy – Wing B", orderId: "ORD-20240608-5521" },
    }).where(eq(leadsTable.id, prasad.id));
    await db.insert(activityLogTable).values({ leadId: prasad.id, type: "stage_change", description: "Stage advanced: dispatched → delivered", userId: null, createdAt: new Date(now - 6 * 3600 * 1000) });
  }

  const nalini = insertedLeads[25]; // lab_test – sample_collected
  if (nalini) {
    await db.update(leadsTable).set({
      transactionContext: { tests: [{ name: "Lipid Profile", code: "LIP-001" }, { name: "Troponin I (hsTnI)", code: "CAR-005" }, { name: "NT-proBNP", code: "CAR-009" }], lab: "Sunrise Diagnostics – Ground Floor", sampleCollectedAt: new Date(now - 4 * 3600 * 1000).toISOString(), labRefId: "LAB-20240612-3301" },
    }).where(eq(leadsTable.id, nalini.id));
  }

  const bharath = insertedLeads[26]; // lab_test – processing
  if (bharath) {
    await db.update(leadsTable).set({
      transactionContext: { tests: [{ name: "Complete Blood Count", code: "CBC-001" }, { name: "HbA1c", code: "DIA-003" }, { name: "Fasting Blood Glucose", code: "DIA-001" }], lab: "Sunrise Diagnostics – Ground Floor", sampleCollectedAt: new Date(now - 2 * 3600 * 1000).toISOString(), labRefId: "LAB-20240612-3485" },
    }).where(eq(leadsTable.id, bharath.id));
    await db.insert(activityLogTable).values({ leadId: bharath.id, type: "stage_change", description: "Stage advanced: sample_collected → processing", userId: null, createdAt: new Date(now - 1 * 3600 * 1000) });
  }

  const sarita = insertedLeads[27]; // web_appointment – scheduled
  if (sarita) {
    await db.update(leadsTable).set({
      transactionContext: { doctorName: "Dr. Kavitha Reddy", specialization: "Gynaecology & Obstetrics", dateTime: new Date(now + 2 * 24 * 3600 * 1000).toISOString(), mode: "In-person", appointmentId: "APT-20240614-1122", opNo: "OP-8834" },
    }).where(eq(leadsTable.id, sarita.id));
  }

  const kiran = insertedLeads[28]; // web_appointment – visited
  if (kiran) {
    await db.update(leadsTable).set({
      transactionContext: { doctorName: "Dr. Ramesh Nair", specialization: "Orthopedics", dateTime: new Date(now - 1 * 24 * 3600 * 1000).toISOString(), mode: "In-person", appointmentId: "APT-20240611-0891", opNo: "OP-7712", visitNotes: "Reviewed X-ray. Physiotherapy plan advised for 6 weeks." },
    }).where(eq(leadsTable.id, kiran.id));
    await db.insert(activityLogTable).values({ leadId: kiran.id, type: "stage_change", description: "Stage advanced: confirmed → visited", userId: u2.id, createdAt: new Date(now - 4 * 3600 * 1000) });
  }

  const divya = insertedLeads[29]; // app_appointment – scheduled
  if (divya) {
    await db.update(leadsTable).set({
      transactionContext: { doctorName: "Dr. Sunita Rao", specialization: "Paediatrics", dateTime: new Date(now + 1 * 24 * 3600 * 1000).toISOString(), mode: "In-person", appointmentId: "APT-20240613-2287", bookedVia: "Affordplan App" },
    }).where(eq(leadsTable.id, divya.id));
  }

  const sudhir = insertedLeads[30]; // app_appointment – confirmed
  if (sudhir) {
    await db.update(leadsTable).set({
      transactionContext: { doctorName: "Dr. Meera Pillai", specialization: "Neurology", dateTime: new Date(now + 3 * 3600 * 1000).toISOString(), mode: "In-person", appointmentId: "APT-20240612-4409", bookedVia: "Affordplan App", confirmationSentAt: new Date(now - 1 * 3600 * 1000).toISOString() },
    }).where(eq(leadsTable.id, sudhir.id));
    await db.insert(activityLogTable).values({ leadId: sudhir.id, type: "stage_change", description: "Stage advanced: scheduled → confirmed", userId: null, createdAt: new Date(now - 1 * 3600 * 1000) });
  }

  // Additional activity logs for the other leads
  await db.insert(activityLogTable).values([
    { leadId: sunita.id, type: "assignment", description: "Assigned to Priya Sharma", userId: u1.id, createdAt: new Date(now - 7.8 * 3600 * 1000) },
    { leadId: lakshmi.id, type: "assignment", description: "Assigned to Priya Sharma", userId: u1.id, createdAt: new Date(now - 5.8 * 3600 * 1000) },
    { leadId: lakshmi.id, type: "status_change", description: "Status changed from new → in_progress", userId: u1.id, createdAt: new Date(now - 5.5 * 3600 * 1000) },
  ]);

  // Predefined tag palette
  await db.insert(tagsTable).values([
    { name: "High Value",        color: "#ef4444" },
    { name: "Follow-up Needed",  color: "#f97316" },
    { name: "VIP",               color: "#8b5cf6" },
    { name: "Insurance Query",   color: "#06b6d4" },
    { name: "Rural Outreach",    color: "#84cc16" },
    { name: "Chronic Condition", color: "#ec4899" },
    { name: "Recent Discharge",  color: "#14b8a6" },
  ]);

  // Quick replies
  await db.insert(quickRepliesTable).values([
    { text: "Your appointment is confirmed. Please arrive 15 minutes early and carry a valid photo ID.", sortOrder: 1 },
    { text: "Our specialist will call you back within 2 hours. Please keep your phone reachable.", sortOrder: 2 },
    { text: "Please carry previous reports, X-rays, and your insurance TPA card for the consultation.", sortOrder: 3 },
    { text: "Thank you for choosing Sunrise Hospital. Wishing you a speedy recovery!", sortOrder: 4 },
    { text: "Your insurance documents are being verified. We will update you by end of day.", sortOrder: 5 },
  ]);

  // Assign tags to named leads
  await db.update(leadsTable).set({ tags: ["High Value", "Insurance Query"] }).where(eq(leadsTable.id, arjun.id));
  await db.update(leadsTable).set({ tags: ["Chronic Condition", "Follow-up Needed"] }).where(eq(leadsTable.id, sunita.id));
  await db.update(leadsTable).set({ tags: ["VIP"] }).where(eq(leadsTable.id, lakshmi.id));
  if (insertedLeads[8])  await db.update(leadsTable).set({ tags: ["Recent Discharge"] }).where(eq(leadsTable.id, insertedLeads[8].id));
  if (insertedLeads[16]) await db.update(leadsTable).set({ tags: ["Rural Outreach", "Follow-up Needed"] }).where(eq(leadsTable.id, insertedLeads[16].id));

  // Segments
  const csvLeadIds = insertedLeads.filter(l => l.sourceChannel === "csv").map(l => l.id);
  const cardioLeadIds = insertedLeads.filter(l => l.specialization === "Cardiology").map(l => l.id);
  const wabaLeadIds = insertedLeads.filter(l => l.sourceChannel === "waba").map(l => l.id);
  const fulfilledLeadIds = insertedLeads.filter(l => l.status === "fulfilled").map(l => l.id);
  const newLeadIds = insertedLeads.filter(l => l.status === "new").map(l => l.id);

  const [seg1, seg2, seg3, seg4, seg5] = await db.insert(segmentsTable).values([
    {
      name: "Q1 Ortho Follow-up List",
      description: "Patients requiring follow-up post orthopedic consultation",
      source: "csv",
      memberLeadIds: csvLeadIds,
      count: csvLeadIds.length,
    },
    {
      name: "Cardiac Risk Patients",
      description: "Patients with cardiology specialization interest",
      source: "affordplan",
      memberLeadIds: cardioLeadIds,
      count: cardioLeadIds.length,
    },
    {
      name: "Active WABA Sessions",
      description: "Patients with an active 24-hour WhatsApp session window",
      source: "manual",
      memberLeadIds: wabaLeadIds,
      count: wabaLeadIds.length,
    },
    {
      name: "Converted Patients – Last 30 Days",
      description: "All fulfilled leads in the past 30 days for feedback campaigns",
      source: "affordplan",
      conditionTree: JSON.stringify({ operator: "AND", conditions: [{ field: "status", op: "eq", value: "fulfilled" }, { field: "createdAt", op: "gte", value: "30daysAgo" }] }),
      memberLeadIds: fulfilledLeadIds,
      count: Math.max(fulfilledLeadIds.length, 48),
    },
    {
      name: "New Leads – Pending Follow-up",
      description: "All new unassigned leads requiring outreach",
      source: "affordplan",
      conditionTree: JSON.stringify({ operator: "AND", conditions: [{ field: "status", op: "eq", value: "new" }, { field: "ownerUserId", op: "is_null" }] }),
      memberLeadIds: newLeadIds,
      count: Math.max(newLeadIds.length, 35),
    },
  ]).returning();

  // Appointments
  const futureDate = (daysFromNow: number, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const pastDate = (daysAgo2: number, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo2);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  await db.insert(appointmentsTable).values([
    // ── Original 10 ──────────────────────────────────────────────────────────
    { leadId: insertedLeads[0].id,  doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "app_booking", status: "confirmed",  datetime: futureDate(2, 10) },
    { leadId: insertedLeads[3].id,  doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "web_booking", status: "booked",     datetime: futureDate(4, 14) },
    { leadId: insertedLeads[15].id, doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "app_booking", status: "completed",  datetime: pastDate(5,  9) },
    { leadId: insertedLeads[16].id, doctorId: d2.id, specialization: "Orthopedics",      sourceChannel: "app_booking", status: "completed",  datetime: pastDate(3, 11) },
    { leadId: insertedLeads[17].id, doctorId: d5.id, specialization: "Gynaecology",      sourceChannel: "web_booking", status: "completed",  datetime: pastDate(7, 10) },
    { leadId: insertedLeads[1].id,  doctorId: d5.id, specialization: "Gynaecology",      sourceChannel: "app_booking", status: "confirmed",  datetime: futureDate(3,  9) },
    { leadId: insertedLeads[4].id,  doctorId: d2.id, specialization: "Orthopedics",      sourceChannel: "web_booking", status: "booked",     datetime: futureDate(7, 10) },
    { leadId: insertedLeads[2].id,  doctorId: d3.id, specialization: "Neurology",        sourceChannel: "app_booking", status: "booked",     datetime: futureDate(5, 14) },
    { leadId: insertedLeads[7].id,  doctorId: d4.id, specialization: "General Medicine", sourceChannel: "app_booking", status: "completed",  datetime: pastDate(10, 11) },
    { leadId: insertedLeads[20].id, doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "app_booking", status: "cancelled",  datetime: pastDate(2,  9) },

    // ── Extra appointments — past (completed / cancelled) ─────────────────────
    { leadId: insertedLeads[5].id,  doctorId: d5.id, specialization: "Gynaecology",      sourceChannel: "web_booking", status: "completed",  datetime: pastDate(1,  11) },
    { leadId: insertedLeads[6].id,  doctorId: d4.id, specialization: "General Medicine", sourceChannel: "app_booking", status: "completed",  datetime: pastDate(2,  10) },
    { leadId: insertedLeads[8].id,  doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "web_booking", status: "completed",  datetime: pastDate(4,  9)  },
    { leadId: insertedLeads[9].id,  doctorId: d3.id, specialization: "Neurology",        sourceChannel: "app_booking", status: "cancelled",  datetime: pastDate(6,  14) },
    { leadId: insertedLeads[10].id, doctorId: d2.id, specialization: "Orthopedics",      sourceChannel: "csv",         status: "completed",  datetime: pastDate(8,  11) },
    { leadId: insertedLeads[11].id, doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "csv",         status: "completed",  datetime: pastDate(9,  10) },
    { leadId: insertedLeads[12].id, doctorId: d4.id, specialization: "General Medicine", sourceChannel: "csv",         status: "completed",  datetime: pastDate(11,  9) },
    { leadId: insertedLeads[13].id, doctorId: d5.id, specialization: "Gynaecology",      sourceChannel: "csv",         status: "completed",  datetime: pastDate(12, 10) },
    { leadId: insertedLeads[18].id, doctorId: d3.id, specialization: "Neurology",        sourceChannel: "web_booking", status: "completed",  datetime: pastDate(13, 11) },
    { leadId: insertedLeads[21].id, doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "app_booking", status: "cancelled",  datetime: pastDate(3,  10) },
    { leadId: insertedLeads[22].id, doctorId: d4.id, specialization: "General Medicine", sourceChannel: "email",       status: "completed",  datetime: pastDate(14,  9) },
    { leadId: insertedLeads[23].id, doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "app_booking", status: "completed",  datetime: pastDate(15, 10) },
    { leadId: insertedLeads[24].id, doctorId: d4.id, specialization: "General Medicine", sourceChannel: "app_booking", status: "completed",  datetime: pastDate(16, 11) },
    { leadId: insertedLeads[25].id, doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "app_booking", status: "completed",  datetime: pastDate(17,  9) },
    { leadId: insertedLeads[26].id, doctorId: d4.id, specialization: "General Medicine", sourceChannel: "app_booking", status: "completed",  datetime: pastDate(18, 10) },
    { leadId: insertedLeads[27].id, doctorId: d5.id, specialization: "Gynaecology",      sourceChannel: "web_booking", status: "completed",  datetime: pastDate(19,  9) },
    { leadId: insertedLeads[28].id, doctorId: d2.id, specialization: "Orthopedics",      sourceChannel: "web_booking", status: "completed",  datetime: pastDate(20, 11) },
    { leadId: insertedLeads[29].id, doctorId: d3.id, specialization: "Neurology",        sourceChannel: "app_booking", status: "completed",  datetime: pastDate(21, 14) },
    { leadId: insertedLeads[30].id, doctorId: d3.id, specialization: "Neurology",        sourceChannel: "app_booking", status: "completed",  datetime: pastDate(22, 10) },

    // ── Extra appointments — future (booked / confirmed) ──────────────────────
    { leadId: insertedLeads[31].id, doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "web_booking", status: "booked",     datetime: futureDate(1, 10) },
    { leadId: insertedLeads[37].id, doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "web_booking", status: "booked",     datetime: futureDate(2, 11) },
    { leadId: insertedLeads[45].id, doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "app_booking", status: "booked",     datetime: futureDate(3, 10) },
    { leadId: insertedLeads[51].id, doctorId: d2.id, specialization: "Orthopedics",      sourceChannel: "web_booking", status: "confirmed",  datetime: futureDate(1,  9) },
    { leadId: insertedLeads[55].id, doctorId: d5.id, specialization: "Gynaecology",      sourceChannel: "app_booking", status: "confirmed",  datetime: futureDate(2, 14) },
    { leadId: insertedLeads[67].id, doctorId: d3.id, specialization: "Neurology",        sourceChannel: "web_booking", status: "booked",     datetime: futureDate(4, 10) },
    { leadId: insertedLeads[77].id, doctorId: d1.id, specialization: "Cardiology",       sourceChannel: "app_booking", status: "confirmed",  datetime: futureDate(1, 11) },
    { leadId: insertedLeads[81].id, doctorId: d4.id, specialization: "General Medicine", sourceChannel: "web_booking", status: "booked",     datetime: futureDate(3,  9) },
  ]);

  // Campaigns
  const [camp1, camp2, camp3, camp4, camp5] = await db.insert(campaignsTable).values([
    {
      name: "Cardiology Camp – June 2025",
      goal: "Promotional",
      audienceSegmentId: seg2.id,
      channels: [{ channel: "sms", templateId: t3.id, templateName: t3.name, perMessageCost: 0.08, senderId: "SUNRSE" }],
      estimatedRecipients: 120,
      costBreakdown: { channelCost: 9.6, fee: 0.48, gst: 1.8144, total: 11.8944 },
      status: "completed",
      createdBy: u2.id,
      approvedBy: u2.id,
      createdAt: new Date(now - 20 * 24 * 3600 * 1000),
      launchedAt: new Date(now - 18 * 24 * 3600 * 1000),
    },
    {
      name: "Win-back Lapsed Patients – May",
      goal: "Win-back",
      audienceSegmentId: seg5.id,
      channels: [
        { channel: "sms", templateId: t2.id, templateName: t2.name, perMessageCost: 0.08, senderId: "SUNRSE" },
        { channel: "whatsapp", templateId: t6.id, templateName: t6.name, perMessageCost: 0.35, wabaContact: "+918045678901" },
      ],
      estimatedRecipients: 35,
      costBreakdown: { channelCost: 15.05, fee: 0.7525, gst: 2.8449, total: 18.6474 },
      status: "live",
      createdBy: u2.id,
      approvedBy: u2.id,
      createdAt: new Date(now - 5 * 24 * 3600 * 1000),
      launchedAt: new Date(now - 3 * 24 * 3600 * 1000),
    },
    {
      name: "Post-Op Care – June Batch",
      goal: "Chronic Care",
      audienceSegmentId: seg4.id,
      channels: [{ channel: "whatsapp", templateId: t5.id, templateName: t5.name, perMessageCost: 0.35, wabaContact: "+918045678901" }],
      estimatedRecipients: 48,
      costBreakdown: { channelCost: 16.8, fee: 0.84, gst: 3.1752, total: 20.8152 },
      status: "submitted",
      createdBy: u1.id,
      createdAt: new Date(now - 2 * 24 * 3600 * 1000),
    },
    {
      name: "Feedback – April Discharge",
      goal: "Feedback",
      audienceSegmentId: seg4.id,
      channels: [{ channel: "whatsapp", templateId: t7.id, templateName: t7.name, perMessageCost: 0.35, wabaContact: "+918045678901" }],
      estimatedRecipients: 72,
      costBreakdown: { channelCost: 25.2, fee: 1.26, gst: 4.7628, total: 31.2228 },
      status: "paused",
      createdBy: u2.id,
      approvedBy: u2.id,
      createdAt: new Date(now - 12 * 24 * 3600 * 1000),
      launchedAt: new Date(now - 10 * 24 * 3600 * 1000),
    },
    {
      name: "Health Tips – Push June",
      goal: "Chronic Care",
      audienceSegmentId: seg1.id,
      channels: [{ channel: "push", templateId: t9.id, templateName: t9.name, perMessageCost: 0.03 }],
      estimatedRecipients: csvLeadIds.length,
      costBreakdown: { channelCost: 0.15, fee: 0.0075, gst: 0.028350, total: 0.185850 },
      status: "draft",
      createdBy: u1.id,
      createdAt: new Date(now - 1 * 24 * 3600 * 1000),
    },
  ]).returning();

  // Extra campaigns (completed with rich historical data)
  const [camp6, camp7, camp8] = await db.insert(campaignsTable).values([
    {
      name: "Monsoon Wellness Camp – July",
      goal: "Promotional",
      audienceSegmentId: seg2.id,
      channels: [
        { channel: "sms",      templateId: t3.id,  templateName: t3.name,  perMessageCost: 0.18, senderId: "SUNRSE" },
        { channel: "whatsapp", templateId: t6.id,  templateName: t6.name,  perMessageCost: 0.65, wabaContact: "+918045678901" },
        { channel: "push",     templateId: t10.id, templateName: t10.name, perMessageCost: 0.04 },
      ],
      estimatedRecipients: 2400,
      costBreakdown: { channelCost: 2088, fee: 104.4, gst: 394.632, total: 2587.032 },
      status: "completed",
      createdBy: u2.id,
      approvedBy: u2.id,
      createdAt: new Date(now - 45 * 24 * 3600 * 1000),
      launchedAt: new Date(now - 40 * 24 * 3600 * 1000),
    },
    {
      name: "Diabetes Awareness – Chronic Care",
      goal: "Chronic Care",
      audienceSegmentId: seg4.id,
      channels: [
        { channel: "whatsapp", templateId: t13.id, templateName: t13.name, perMessageCost: 0.65, wabaContact: "+918045678901" },
        { channel: "push",     templateId: t11.id, templateName: t11.name, perMessageCost: 0.04 },
      ],
      estimatedRecipients: 1800,
      costBreakdown: { channelCost: 1242, fee: 62.1, gst: 234.738, total: 1538.838 },
      status: "completed",
      createdBy: u1.id,
      approvedBy: u2.id,
      createdAt: new Date(now - 32 * 24 * 3600 * 1000),
      launchedAt: new Date(now - 28 * 24 * 3600 * 1000),
    },
    {
      name: "Post-Discharge Follow-up – June",
      goal: "Chronic Care",
      audienceSegmentId: seg4.id,
      channels: [
        { channel: "sms",      templateId: t1.id, templateName: t1.name, perMessageCost: 0.18, senderId: "SUNRSE" },
        { channel: "whatsapp", templateId: t8.id, templateName: t8.name, perMessageCost: 0.65, wabaContact: "+918045678901" },
      ],
      estimatedRecipients: 480,
      costBreakdown: { channelCost: 398.4, fee: 19.92, gst: 75.2976, total: 493.6176 },
      status: "live",
      createdBy: u2.id,
      approvedBy: u2.id,
      createdAt: new Date(now - 8 * 24 * 3600 * 1000),
      launchedAt: new Date(now - 6 * 24 * 3600 * 1000),
    },
  ]).returning();

  // Campaign Metrics for live/completed/paused
  await db.insert(campaignMetricsTable).values([
    {
      campaignId: camp1.id,
      sent: 1240, delivered: 1082, opened: 648, clicked: 218, converted: 89,
      spend: "1189.44", revenueAttributed: "118944",
      channelBreakdown: [{ channel: "sms", sent: 1240, delivered: 1082, opened: 648, clicked: 218, converted: 89 }],
    },
    {
      campaignId: camp2.id,
      sent: 845, delivered: 778, opened: 412, clicked: 115, converted: 43,
      spend: "1864.65", revenueAttributed: "62700",
      channelBreakdown: [
        { channel: "sms",      sent: 845, delivered: 758, opened: 380, clicked: 102, converted: 38 },
        { channel: "whatsapp", sent: 845, delivered: 778, opened: 412, clicked: 115, converted: 43 },
      ],
    },
    {
      campaignId: camp4.id,
      sent: 720, delivered: 648, opened: 340, clicked: 92, converted: 28,
      spend: "3122.28", revenueAttributed: "41160",
      channelBreakdown: [{ channel: "whatsapp", sent: 720, delivered: 648, opened: 340, clicked: 92, converted: 28 }],
    },
    {
      campaignId: camp6.id,
      sent: 2400, delivered: 2088, opened: 1124, clicked: 402, converted: 162,
      spend: "2587.03", revenueAttributed: "214000",
      channelBreakdown: [
        { channel: "sms",      sent: 2400, delivered: 2040, opened:  980, clicked: 320, converted: 118 },
        { channel: "whatsapp", sent: 2400, delivered: 2088, opened: 1124, clicked: 402, converted: 162 },
        { channel: "push",     sent: 2400, delivered: 2280, opened: 1560, clicked: 540, converted: 204 },
      ],
    },
    {
      campaignId: camp7.id,
      sent: 1800, delivered: 1638, opened: 982, clicked: 342, converted: 128,
      spend: "1538.84", revenueAttributed: "184000",
      channelBreakdown: [
        { channel: "whatsapp", sent: 1800, delivered: 1638, opened: 982, clicked: 342, converted: 128 },
        { channel: "push",     sent: 1800, delivered: 1710, opened: 1188, clicked: 396, converted: 152 },
      ],
    },
    {
      campaignId: camp8.id,
      sent: 480, delivered: 442, opened: 246, clicked: 84, converted: 32,
      spend: "493.62", revenueAttributed: "48000",
      channelBreakdown: [
        { channel: "sms",      sent: 480, delivered: 432, opened: 210, clicked: 68, converted: 24 },
        { channel: "whatsapp", sent: 480, delivered: 442, opened: 246, clicked: 84, converted: 32 },
      ],
    },
  ]);

  // Wallet
  await db.insert(walletTable).values({ hospitalId: 1, balance: "12450.00" });
  await db.insert(walletTransactionsTable).values([
    { type: "topup", amount: "25000.00", description: "Initial wallet load", reference: "TOPUP-001", createdAt: new Date(now - 60 * 24 * 3600 * 1000) },
    { type: "debit", amount: "11.89", description: "Campaign: Cardiology Camp – June 2025", reference: "CAMP-1", createdAt: new Date(now - 18 * 24 * 3600 * 1000) },
    { type: "debit", amount: "18.65", description: "Campaign: Win-back Lapsed Patients – May", reference: "CAMP-2", createdAt: new Date(now - 3 * 24 * 3600 * 1000) },
    { type: "topup", amount: "10000.00", description: "Wallet top-up via PayU/Easebuzz", reference: "TOPUP-002", createdAt: new Date(now - 30 * 24 * 3600 * 1000) },
    { type: "debit", amount: "31.22", description: "Campaign: Feedback – April Discharge", reference: "CAMP-4", createdAt: new Date(now - 10 * 24 * 3600 * 1000) },
    { type: "debit", amount: "12487.24", description: "Campaign: Mass SMS Blast (legacy)", reference: "CAMP-0", createdAt: new Date(now - 45 * 24 * 3600 * 1000) },
  ]);

  // Invoices
  await db.insert(invoicesTable).values([
    { campaignId: camp1.id, number: "INV-2025-001", amount: "11.89", gst: "1.81", pdfUrl: "#invoice-INV-2025-001", createdAt: new Date(now - 18 * 24 * 3600 * 1000) },
    { campaignId: camp2.id, number: "INV-2025-002", amount: "18.65", gst: "2.84", pdfUrl: "#invoice-INV-2025-002", createdAt: new Date(now - 3 * 24 * 3600 * 1000) },
    { campaignId: camp4.id, number: "INV-2025-003", amount: "31.22", gst: "4.76", pdfUrl: "#invoice-INV-2025-003", createdAt: new Date(now - 10 * 24 * 3600 * 1000) },
  ]);

  // Channel Config
  await db.insert(channelConfigTable).values({
    hospitalId: 1,
    channels: [
      {
        type: "sms",
        status: "live",
        smsHeaders: [
          { value: "SUNRSE", ownership: "hospital", isDefault: true },
          { value: "AFFORD", ownership: "affordplan", isDefault: false },
          { value: "HLTHBZ", ownership: "affordplan", isDefault: false },
        ],
        wabaNumbers: [],
        pushWorkspaceId: null,
      },
      {
        type: "whatsapp",
        status: "live",
        smsHeaders: [],
        wabaNumbers: [
          { number: "+918045678901", ownership: "hospital", isDefault: true },
          { number: "+919900012345", ownership: "affordplan", isDefault: false },
        ],
        pushWorkspaceId: null,
      },
      {
        type: "push",
        status: "pending",
        smsHeaders: [],
        wabaNumbers: [],
        pushWorkspaceId: "WS-SUNRISE-8291",
      },
    ],
  });

  // Send Rules
  await db.insert(sendRulesTable).values({ hospitalId: 1, sendWindowStart: "09:00", sendWindowEnd: "21:00", frequencyCap: 3 });

  // Notifications
  await db.insert(notificationsTable).values([
    { title: "Campaign Completed", body: 'Campaign "Cardiology Camp – June 2025" completed. 9 conversions, ₹11,200 revenue attributed.', type: "campaign_complete", read: "true", createdAt: new Date(now - 18 * 24 * 3600 * 1000).toISOString() },
    { title: "Campaign Live", body: 'Campaign "Win-back Lapsed Patients – May" is now live. Sending to 35 recipients.', type: "campaign_live", read: "false", createdAt: new Date(now - 3 * 24 * 3600 * 1000).toISOString() },
    { title: "Campaign Submitted for Approval", body: '"Post-Op Care – June Batch" is awaiting manager approval.', type: "campaign_submitted", read: "false", createdAt: new Date(now - 2 * 24 * 3600 * 1000).toISOString() },
    { title: "Low Wallet Balance Alert", body: "Your wallet balance has dropped below ₹15,000. Please top up to avoid campaign interruptions.", type: "wallet_low", read: "false", createdAt: new Date(now - 1 * 24 * 3600 * 1000).toISOString() },
    { title: "New Template Request", body: 'Priya Sharma has submitted a new template request: "Monsoon Health Camp – Hindi".', type: "template_request", read: "false", createdAt: new Date(now - 5 * 3600 * 1000).toISOString() },
  ]);

  logger.info("Seed complete");
}
