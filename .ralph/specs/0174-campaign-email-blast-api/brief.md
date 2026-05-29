# Specification: Campaign Email Blast API - Brief

## 1. Functional Objective
This feature introduces an automated Campaign Email Blast engine for marketing campaigns.
It allows tenants to dispatch a personalized bulk email blast to all members of a specific Campaign (`campaignMembers`).
It compiles a designated Email Template using merge fields resolved from each member's record (Lead or Contact, along with associated Account and Opportunity records if applicable).
For each member, it generates a personalized email log (stored as an Activity of type `"email"`), links it to the respective entities, updates the campaign member's status to `"Sent"`, and keeps a secure audit trail.

## 2. Technical Scope
- **Tenancy Isolation**: Strictly enforce active tenant org row-level security (RLS) constraints for all lookups (Campaigns, Members, Leads, Contacts, Accounts, Opportunities, Templates) and mutations (Activities, Links, Member updates, Audit logs).
- **REST Endpoints**:
  - `POST /api/campaigns/:id/email-blast` - Trigger a personalized bulk email blast to all active members of the Campaign.
- **Bulk Personalization Engine**:
  - Validate that the campaign, template, and sender email are valid.
  - Load campaign members, and for each:
    - Load Lead or Contact data.
    - If Contact has a parent Account, fetch the Account and the most recently updated Opportunity under that Account to populate merge fields.
    - Compile the subject and body using `compileEmailTemplate`.
    - Create an email activity log, insert it, link it, update campaign member status, and log the audit trail.
- **Verification**: Thorough RLS and integration tests asserting clean bulk dispatch, personalized merge resolution, and robust multi-tenant security boundary validation.
