"""Office lever templates. Maps committees and offices to the decisions donors care about.
These are starting points for step 7 of the protocol, not findings; every row is marked template."""

COMMITTEE_LEVERS = [
    # keyword in committee name, decision, which blocs care
    ("Financial Services", "Crypto market structure, stablecoin rules, bank capital and SEC oversight bills", "Crypto and finance; Wall Street and banking; Insurance and tort"),
    ("Banking, Housing", "Crypto market structure, bank regulation, nominations to the Fed, SEC and FDIC", "Crypto and finance; Wall Street and banking; Real estate"),
    ("Energy and Commerce", "Drug pricing, Medicaid, energy permitting, data center power, AI and privacy preemption, telecom", "Health care and pharma; Utilities and energy; Utilities and data centers; AI industry; Tech"),
    ("Commerce, Science", "AI preemption, spectrum, aviation, transportation safety, consumer protection, FTC and FCC nominations", "AI industry; Tech; Crypto and finance"),
    ("Ways and Means", "Tax code: carried interest, opportunity zones, energy credits, health tax rules, tariffs and trade", "Billionaire megadonor; Wall Street and banking; Utilities and energy; Health care and pharma"),
    ("Committee on Finance", "Tax code, Medicare and Medicaid, trade and tariffs, Treasury and IRS nominations", "Billionaire megadonor; Wall Street and banking; Health care and pharma"),
    ("Armed Services", "National Defense Authorization Act, weapons programs, base decisions, defense contracts", "Defense contractors; AI industry; Tech"),
    ("Appropriations", "Annual spending bills and earmarks, including detention funding and defense procurement", "Defense contractors; Detention vendors; Developers and construction; Health care and pharma"),
    ("Agriculture", "Farm bill, sugar program, crop insurance, CFTC jurisdiction over prediction markets and crypto commodities", "Sugar and agriculture; Crypto and finance; Gambling"),
    ("Judiciary", "Antitrust, immigration enforcement, judicial nominations, tort and liability law, online platform rules", "Tech; Detention vendors; Insurance and tort; AI industry"),
    ("Homeland Security", "Immigration detention, border contracts, cybersecurity, FEMA", "Detention vendors; Defense contractors; Tech"),
    ("Transportation and Infrastructure", "Highway and transit funding, water projects, aviation, pipelines", "Developers and construction; Oil and gas; Labor unions"),
    ("Environment and Public Works", "Highway bill, EPA rules, water projects, nuclear regulation", "Developers and construction; Utilities and energy; Oil and gas"),
    ("Natural Resources", "Federal lands and offshore leasing, mining, tribal affairs, water", "Oil and gas; Utilities and energy; Sugar and agriculture"),
    ("Energy and Natural Resources", "Federal lands leasing, energy policy, FERC and DOE nominations", "Oil and gas; Utilities and energy; Utilities and data centers"),
    ("Education and Workforce", "School choice, student loans, labor law, NLRB oversight", "School choice and family; Labor unions"),
    ("Health, Education, Labor", "Drug pricing, FDA, labor law, NLRB nominations, education", "Health care and pharma; Labor unions; School choice and family"),
    ("Foreign Affairs", "Arms sales, Israel aid, sanctions, foreign assistance", "Pro-Israel; Defense contractors"),
    ("Foreign Relations", "Arms sales, Israel aid, sanctions, ambassador confirmations", "Pro-Israel; Defense contractors"),
    ("Science, Space, and Technology", "AI research, NASA and space contracts, NIST standards", "AI industry; Tech; Defense contractors"),
    ("Oversight", "Investigations, federal workforce, procurement oversight", "Enforcement and disclosure"),
    ("Intelligence", "Intelligence authorization, surveillance authorities, classified contracts", "Defense contractors; Tech"),
    ("Veterans", "VA health care contracts and community care", "Health care and pharma"),
    ("Indian Affairs", "Tribal gaming, Indian Gaming Regulatory Act, tribal lands", "Gambling"),
    ("Small Business", "SBA lending and contracting set asides", "Wall Street and banking"),
    ("Rules", "Which bills reach the floor and under what terms", "Party and leadership"),
    ("Budget", "Budget resolutions and reconciliation instructions", "Billionaire megadonor; Party and leadership"),
    ("Select Committee on the Strategic Competition", "China policy, outbound investment, TikTok and chip export controls", "Tech; AI industry; Billionaire megadonor"),
    ("House Administration", "Federal election law, FEC oversight, campaign finance rules", "Enforcement and disclosure; Party and leadership"),
    ("Rules and Administration", "Federal election law, FEC nominations, campaign finance rules", "Enforcement and disclosure; Party and leadership"),
    ("Ethics", "Member ethics investigations", "Enforcement and disclosure"),
]

SENATE_GENERAL = [
    ("Confirmation votes for cabinet, judges, regulators and ambassadors", "Every bloc with a regulator; Wall Street and banking; Crypto and finance; Health care and pharma"),
    ("Filibuster and cloture votes on major legislation", "Party and leadership"),
]
HOUSE_GENERAL = [
    ("Floor votes on reconciliation, appropriations and the NDAA", "Billionaire megadonor; Defense contractors; Health care and pharma"),
    ("Earmark requests for the district", "Developers and construction; Health care and pharma"),
]
GOVERNOR_GENERAL = [
    ("Public utility commission appointments and rate case posture", "Utilities and energy; Utilities and data centers"),
    ("Gaming regulator appointments and tribal compact negotiation", "Gambling"),
    ("State budget, line item veto and bill signing or veto", "Every bloc"),
    ("Agency head appointments and major state contracts, including Medicaid managed care", "Health care and pharma; Detention vendors; Developers and construction"),
    ("University and school board appointments, voucher and school choice program funding", "School choice and family"),
    ("Insurance commissioner or regulator appointment and tort law bills", "Insurance and tort"),
    ("Emergency declarations and no bid emergency procurement", "Detention vendors; Developers and construction"),
    ("Judicial appointments where the governor appoints", "Insurance and tort; Ideological groups"),
    ("Data center incentives, permitting and power siting", "Utilities and data centers; AI industry; Tech"),
    ("Clemency, pardons and suspension powers", "Enforcement and disclosure"),
]


def levers_for(office, committees):
    rows = []
    office = office or ''
    if 'Governor' in office:
        for d, b in GOVERNOR_GENERAL:
            rows.append((d, 'Governor', b))
    if 'Senate' in office:
        for d, b in SENATE_GENERAL:
            rows.append((d, 'U.S. Senate', b))
    if 'House' in office:
        for d, b in HOUSE_GENERAL:
            rows.append((d, 'U.S. House', b))
    seen = set()
    for c in committees:
        for key, d, b in COMMITTEE_LEVERS:
            if key.lower() in c.lower() and d not in seen:
                seen.add(d)
                rows.append((d, c, b))
    return rows
