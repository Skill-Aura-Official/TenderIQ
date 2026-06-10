# TenderIQ UI/UX Screen Breakdown Specification

**Version:** 1.0
**Product:** TenderIQ
**Type:** AI-Powered Tender Discovery & Qualification Platform

---

# 1. Product Overview

TenderIQ is an AI-powered SaaS platform that helps businesses discover, qualify, and manage government procurement tenders from a single dashboard.

## Primary Goals

* Discover relevant tenders quickly
* Understand eligibility instantly
* Track deadlines and corrigendum updates
* Manage active bids efficiently
* Organize compliance documents

## Design Principles

* Enterprise SaaS
* Minimal and clean
* Professional and trustworthy
* Dashboard-first experience
* High information density without clutter
* Responsive desktop-first design

---

# 2. Information Architecture

```text
Authentication
├── Login
├── Signup
└── Forgot Password

Onboarding
├── Welcome
├── Company Profile Setup
├── Tender Preferences
├── Document Upload
└── Match Generation

Application
├── Dashboard
├── Tender Discovery
├── Tender Detail
├── Bid Pipeline
├── Document Vault
├── Alerts Center
└── Settings
```

---

# 3. Global Layout Structure

## Sidebar Navigation

* Dashboard
* Discover
* Pipeline
* Documents
* Alerts
* Settings

## Top Navigation

* Global Search
* Notifications
* User Profile Menu

## Global Components

### Match Score Badge

| Score  | Label     |
| ------ | --------- |
| 90-100 | Excellent |
| 70-89  | Good      |
| 50-69  | Moderate  |
| 0-49   | Poor      |

### Deadline Indicator

| Days Remaining | Status   |
| -------------- | -------- |
| 0-2            | Critical |
| 3-7            | Warning  |
| 8+             | Normal   |

---

# 4. Screen 01 — Login

## Purpose

Authenticate existing users.

## Layout

```text
-----------------------------------
Logo

Welcome Back

Email Field
Password Field

Login Button

Google Sign In

Forgot Password
Create Account
-----------------------------------
```

## Components

### Inputs

* Email
* Password

### Actions

* Login
* Google OAuth

## Success State

Redirect to Dashboard.

## Error States

* Invalid Credentials
* Network Error
* OAuth Failure

---

# 5. Screen 02 — Signup

## Purpose

Create new account.

## Components

### User Information

* Full Name
* Work Email
* Password
* Confirm Password

### Actions

* Create Account
* Sign Up with Google

## Success State

Redirect to onboarding.

## Error States

* Email already exists
* Weak password
* Invalid email

---

# 6. Screen 03 — Welcome Onboarding

## Purpose

Introduce platform value.

## Components

### Hero Section

* Headline
* Supporting description

### Benefits

#### Discover Faster

Reduce manual tender searching.

#### Qualify Better

Understand eligibility instantly.

#### Never Miss Deadlines

Get proactive alerts.

### CTA

* Get Started

### Progress

Step 1 of 4

---

# 7. Screen 04 — Company Profile Setup

## Purpose

Capture business information.

## Sections

### Company Information

* Company Name
* Industry
* Services Offered
* Company Size

### Compliance Information

* GST Number
* PAN Number
* MSME Status

### Certifications

* ISO
* Startup India
* Other Certifications

### Location

* States of Operation

## Actions

* Back
* Continue

## Behavior

Autosave enabled.

---

# 8. Screen 05 — Tender Preferences

## Purpose

Configure tender recommendations.

## Sections

### Preferred Categories

Multi-select categories.

### Preferred States

Multi-select locations.

### Tender Value Range

* Minimum Value
* Maximum Value

### Keywords

Custom keyword tags.

### Authorities

Preferred issuing organizations.

## Actions

* Back
* Continue

---

# 9. Screen 06 — Document Upload

## Purpose

Collect initial compliance documents.

## Upload Categories

* GST Certificate
* PAN Card
* MSME Certificate
* ISO Certificates
* Experience Certificates

## Features

* Drag and Drop Upload
* Multi-file Upload
* Progress Tracking
* Preview

## Actions

* Skip
* Continue

---

# 10. Screen 07 — Match Generation

## Purpose

Generate personalized recommendations.

## Steps

1. Analyze Company Profile
2. Match Available Tenders
3. Calculate Eligibility
4. Generate Recommendations

## UI Elements

* Progress Indicator
* Loading Animation
* Status Updates

## Completion

Redirect to Dashboard.

---

# 11. Screen 08 — Dashboard

## Purpose

Primary command center.

## Layout

```text
Sidebar
│
├── Top Navigation
│
├── KPI Cards
│
├── Recommended Tenders
│
├── Upcoming Deadlines
│
└── Recent Alerts
```

## KPI Cards

* New Tenders Today
* Saved Tenders
* Preparing Bids
* Submitted Bids

## Recommended Tender Cards

### Fields

* Match Score
* Tender Title
* Authority
* Tender Value
* Deadline
* Category
* State

### Actions

* Save
* Open
* Dismiss

## Secondary Widgets

### Upcoming Deadlines

Critical deadlines list.

### Recent Alerts

Latest notifications.

---

# 12. Screen 09 — Tender Discovery

## Purpose

Browse all tenders.

## Layout

### Filter Sidebar

* Category
* State
* Authority
* Value Range
* Match Score
* Deadline
* Portal

### Results Area

Tender cards or table view.

## Tender Card Fields

* Title
* Match Score
* Value
* Authority
* Deadline
* Category

## Actions

* View Details
* Save Tender

```
```
