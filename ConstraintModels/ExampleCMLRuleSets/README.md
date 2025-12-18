## Constraints and Use Cases in English

This section describes in plain English the business rules that are implemented in the CML (Constraint Modeling Language) code files. These constraints correspond to the rule sets found in the accompanying CML files (AutoSilverFinal.cml, MedicalFinal.cml, and CommercialFinal.cml).

### Auto Silver Sample Constraints

For the Auto Silver rule examples, assume the following constraints:

-  For the Auto Silver bundle, if the most expensive vehicle is worth over $50,000 and the oldest vehicle's model year is before 2020, the bundle must have a Medical Payment coverage with $2000 limit.
- For a Vehicle bundle, vehicles newer than 2023 must have Collision coverage with $5000 limit.
- For a Vehicle bundle, vehicles older than 2020 with Collision coverage selected with $200 deductible, the vehicle bundle must not have Uninsured Motorist coverage.
-  For a driver, Driver Age and First Licensed Age must be greater than 16.
-  For the Auto Silver bundle, if at least one vehicle doesn't have Anti-Theft, at least one driver has accident points greater than 5, and item price for product is over $100: Must have Bodily Injury & Property Damage Coverage; Property damage per Accident Limit of BIPD must be hidden; $2000 of Bodily Injury Per Accident Limit of BIPD must be hidden.
-  For the Auto Silver bundle, if the quote has medical payments covered with a limit of $1000, and the current user is a standard user, the quote must have BIPD with a bodily injury per person limit of $1000


### Family Health Insurance Comprehensive (Medical) Sample Constraints

For the Family Health Insurance Comprehensive rule examples, assume the following constraints:

- For a primary member, if the primary member has Outpatient coverage, and the primary member is a male over 40 years old or is married, the policy must have Preventive Care and Wellness coverage with Deductible Limit of $5000, and must have Chronic Disease coverage.
- If the current user is a system administrator, and the primary member is female with at least one single dependent member: For the primary member, exclude Critical Illness Surgery and hide attribute Out Network Copay for Outpatient coverage; For a dependent member, hide the attribute value Others for the Gender field and add Critical Illness Surgery coverage.
- If a dependent member is younger than 30, and the primary member's Preventive Care and Wellness has Out Network Deductible Limit is greater than or equal to $250, the dependent member must have Preventive Care and Wellness with Annual out of pocket limit of $20,000.
- If the primary member has Outpatient coverage and the current user profile is a system administrator, the dependent member must have Chronic Disease coverage, and the primary member's Outpatient coverage must have Doctor visit copay of $10,000.
- If the primary member's age is greater than 40:
    - any dependents under 30 must have Outpatient coverage;
    - if the oldest dependent member's age is less than 30, the primary member must have Chronic Disease coverage.


### Commercial Property Insurance( Commercial) Sample Constraints

For the Commercial Property Insurance rule examples, assume the following constraints:

- For a Commercial Property Insurance bundle, If the aggregated total Commercial Building Burglary coverage Limits is $50,000, and the aggregated total Warehouse Building Burglary coverage is $50,000, then add Commercial General Liability coverage and set Limit to $50,000.
- For an Equipment bundle, if Commercial General Liability coverage Limit is less than $2,000,000, and if the business has no locations in New York, and Building Burglary coverage Limit is less than $50,000, and General Equipment Value is greater than $100,000, then add General Equipment coverage to General Equipment bundle and set General Equipment coverage Limit to $50,000.
- For an Equipment bundle, if Equipment is in 'Good' Condition, and UserProfile is system administrator, and building Age is greater than 6, and location is NY, then exclude Equipment coverage of the Equipment.
- For a location bundle, if City is Boston, State must be MA; if City is San Francisco, State must be CA.
- For a Commercial Property Insurance bundle, if Agreed Value of Commercial Property Insurance is greater than $10,000, hide SIC code attribute.
- For a Commercial Property Insurance bundle, if at least one equipment's Condition is Good, and at least one building Age is 6:
    - add General Liability coverage. 
    - For a Building bundle, if at least one equipment's Condition is Good and its Age is 6, hide its attribute Sprinklers; 
    - For a Equipment bundle, hide Attribute Value 'New' for Equipment Condition.