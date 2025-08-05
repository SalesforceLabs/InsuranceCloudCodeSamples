/* =====================================================
* Gold Standard CML Constraint Model for Auto Silver Product
* =====================================================
A product configuration constraints CML file for Auto Silver Product 
covering use cases of:
- Base constraint
- Multi-instance constraint
- Require coverage constraint
- Exclude coverage constraint
- Cardinality constraint
- Parent cardinality constraint
- Cross Product constraint
- Grandchild products constraint
- Siblings products constraint
*/

/*
Get Quote/Sales Transaction Level Attribute from Context Definition, such as User Profile, Quote Start Date, etc.
*/
@(contextPath = "SalesTransaction.UserProfile", attributeSource = "ST")
extern string UserProfile;

/*
Root Product Bundle: Auto Silver
@closeRelation = true: tell the constraint engine not to add any new instances in the relation, but the ones added by users or require rules are allowed.
@propagateUp = true: tell the constraint engine only propagate from child to parent for aggregation function such as sum, max, count, etc.
@sequence = 1: Indicates the sequence in which the variables are configured. The constraint engine assigns the values based on the sequence, with the lowest in the
sequence assigned first. (only effective within a type)

Multi-instance use case: using aggregate functions for attributes from child relations (see "relation auto : Vehicle"). 
If there's only 1 instance allowed for this relation, then OK to get attributes without aggregate functions
*/
type AutoSilver {
    @(closeRelation = true, propagateUp = true, sequence = 1)
    relation auto : Vehicle { 
        maxAutoValue = max(Auto_Value); 
        minAutoYear = min(Year);
        maxDriverAccPoint1 = max(maxDriverAccPoint);
        autoHasAntiTheft = count(Has_Anti_Theft > 0);
    }
    
    @(sequence = 2)
    relation bodilyinjurypropertydamage : BodilyInjuryPropertyDamage[0..1];
    
    @(sequence = 3)
    relation medicalpayments : MedicalPayments[0..1] {
        medicalLimit = Limit;
        medicalDeductible = Deductible;
        medicalInputUnitPrice = inputUnitPrice;
    }

    /*
    Get Quote Line Item/Sales Transaction Item Level Attribute from Context Definition, such as Item Total Price, Item Discount Amount, etc.
    tagName should be the same as Attribute Tag
    */
    @(tagName = "ItemTotalPrice")
    decimal(2) totalPrice;

    /*
    Constraint 1: A bundle with the most expensive car over $50,000 and the oldest car before 2020 must have Medical Payment Coverage with $2000 limit
    
    Multi-instance Constraint
    Require coverage constraint
    Cross Product constraint
    */
    boolean constraint1 = auto.maxAutoValue >= 50000 && auto.minAutoYear < 2020;
    require(constraint1, medicalpayments[MedicalPayments], "Auto add Medical Payments");
    constraint(constraint1 && medicalpayments[MedicalPayments] > 0 -> medicalpayments[MedicalPayments].Limit == 2000, "Medical coverage set to $2000 for older high-value vehicles");

    /*
    Constraint 5: A bundle of at least one car doesn't have Anti-Theft, at least one driver has accident point greater than 5, no medical payment coverage, and total price for product bundle over $100:
        - Must have BIPD coverage (bodily injury & property damage)
        - Attribute: Property damage per Accident Limit of BIPD must be hidden (see under type BodilyInjuryPropertyDamage)
        - Value: $2000 of Bodily Injury Per Accident Limit of BIPD must be hidden (see under type BodilyInjuryPropertyDamage)

    @abort = true: preventing the constraint engine from recursively backtracking and causing timeout, instead, surface configuration error message when encountering.
    
    Multi-instance Constraint 
    Require coverage constraint
    Cardinality constraint 
    Parent cardinality constraint 
    Cross Product constraint
    Grandchild products constraint 
    Siblings products constraint
    */
    boolean autoCondition = auto[Vehicle] > 0 &&  !auto.autoHasAntiTheft; 
    boolean driverCondition = auto.maxDriverAccPoint1 > 5;
    boolean totalPriceCondition = totalPrice > 10;
    boolean constraint5 = autoCondition && driverCondition && totalPriceCondition && medicalpayments[MedicalPayments] == 0;
	@(abort = true)
    require(constraint5, bodilyinjurypropertydamage[BodilyInjuryPropertyDamage], "BIPD is required when Auto IsElectricVehicle and Antitheft is false and Driver accident points > 5 and Collision is selected and MedicalPayments is NOT selected");


    /*
    Constraint 6: A bundle with Medical Payment coverage with limit $1000, opearted by standard user, and the unit price for medical payment is over $220:
        - Must have BIPD with Bodily Injury Per Person Limit $1000

    Require coverage constraint
    Cardinality constraint 
    Cross Product constraint
    Siblings products constraint
    */
	boolean constraint6 = medicalpayments[MedicalPayments] == 1 && medicalpayments.medicalDeductible == 500 && UserProfile == "Standard User" && medicalpayments.medicalInputUnitPrice > 220;
    require(constraint6, bodilyinjurypropertydamage[BodilyInjuryPropertyDamage], "BIPD is required when MedicalPayments is selected at 1k limit");
    constraint(constraint6 && bodilyinjurypropertydamage[BodilyInjuryPropertyDamage] -> bodilyinjurypropertydamage[BodilyInjuryPropertyDamage].Bodily_Injury_Per_Person_Limit == 1000);
}

/*
Product Classification: Auto

@configurable = false: prevent the engine from modifying/assigning the value of an attribute.
Best Practices for variable initialization: 
    - for int variables, if using picklist possible, using picklist. If not possible, please add domain (possible values).
    - for picklist variables, set default value if possible. 
    - for variables that are not supposed to be modified by the constraint engine, add configurable = false annotation.
*/
type Auto {
    @(configurable = false)
    decimal(2) Auto_Value;

    int Year = [1980..2026];

    @(configurable = false)
    string Colour;

    @(configurable = false)
    string Make;

    @(configurable = false)
    int License_Number;

    string License_State;

    @(configurable = false)
    string Model;

    boolean Is_Electric_Vehicle;

    boolean Has_Anti_Theft;

    string AssetRecordName;

}

/*
Product Bundle: Auto
*/
type Vehicle : Auto {
    int maxDriverAccPoint = driver.maxDriverAccPoint;

    @(sequence = 4)
    relation collision : Collision[0..1];

    @(sequence = 2)
    relation comprehensive : Comprehensive[0..1];

    @(sequence = 3)
    relation uninsuredMotorist : UninsuredMotorist[0..1];

    @(closeRelation = true, propagateUp = true, sequence = 1)
    relation driver : AutoDriver[0..5] {
        maxDriverAccPoint = max(Driver_Accident_Points);
    }

    /*
    Constraint 2: Car is newer than 2023 must have Collision Coverage with $5000 limit.

    Require coverage constraint
    Cross Product constraint
    */
    boolean constraint2 = Year > 2023;
    constraint(constraint2 -> collision[Collision], "auto add collision coverage"); 
    constraint(constraint2 && collision[Collision] > 0 -> collision[Collision].Limit == 5000, "set collision limit to 5000");

    /*
    Constraint 3: Car is older than 2020 and Collision Coverage is selected with $200 deductible MUST NOT have Uninsured Motorist Coverage.

    Exlude coverage constraint
    Cross Product constraint
    */
    boolean constraint3 = collision[Collision] > 0 && collision[Collision].Deductible == 200 && Year < 2020;
    exclude(constraint3, uninsuredMotorist[UninsuredMotorist]);
    
    require(collision[Collision] > 0 && collision[Collision].Deductible == 200 && Year < 2020 && UserProfile == "Standard User", comprehensive[Comprehensive]);
    message(Auto_Value > 500000, "Error: Insurance cant be provided","Error");
    message(Auto_Value == null , "Error: Auto value cant be null","Error");

}

/*
Product Classification: Driver
Best Practices: 
*/
type Driver {
    int Driver_Accident_Points = [0..10];

    int Driver_MVR_Points;

    string Driving_License;

    int Age_First_Licensed = [0..100];

    //int Contact_Number;

    @(configurable = false)
    string E_Mail;

    @(configurable = false)
    string State;

    @(configurable = false)
    int Age = [0..100];

    @(configurable = false)
    string First_Name;

    @(configurable = false)
    string Last_Name;

    /*
    Constraint 4: Driver Age and First Licensed Age must be equal or greater than 16.

    Base constraint
    */
    message(Age_First_Licensed < 16, "Don’t know who gave you license to driver before 16, legally!", "Warning");
    message(Age < 16, "Error”: Driver is underaged to be added to the quote", "Error");

}

/*
Product: Driver
*/
type AutoDriver : Driver;

/*
Product: UninsuredMotorist
*/
@(split = false)
type UninsuredMotorist {
    int Deductible = [0, 50, 100, 200, 500];

    int Property_Damage_Per_Accident_Limit = [500, 1000, 1500, 2000];

    int Bodily_Injury_Per_Person_Limit = [500, 1000, 1500, 2000];

    int Bodily_Injury_Per_Accident_Limit = [500, 1000, 1500, 2000];

    int Limit = [1000, 2000, 5000, 10000, 25000, 50000];

    int Number_Of_Days = [1, 3, 5, 10, 15, 30];
    

}

/*
Product: Collision
*/
@(split = false)
type Collision {
    @(domainComputation = false)
    int Deductible = [0, 50, 100, 200, 500];

    @(domainComputation = false)
    int Property_Damage_Per_Accident_Limit = [500, 1000, 1500, 2000];

    @(domainComputation = false)
    int Bodily_Injury_Per_Person_Limit = [500, 1000, 1500, 2000];

    @(domainComputation = false)
    int Bodily_Injury_Per_Accident_Limit = [500, 1000, 1500, 2000];

    @(defaultValue = "1000", domainComputation = false)
    int Limit = [1000, 2000, 5000, 10000, 25000, 50000];

    int Number_Of_Days = [1, 3, 5, 10, 15, 30];

}

/*
Product: Bodily Injury Property Damage
*/
@(split = false)
type BodilyInjuryPropertyDamage {
    @(defaultValue = "100", domainComputation = false)
    int Deductible = [0, 50, 100, 200, 500];

    @(defaultValue = "1000", domainComputation = false)
    int Bodily_Injury_Per_Person_Limit = [500, 1000, 1500, 2000];

    @(defaultValue = "1000", domainComputation = false)
    int Property_Damage_Per_Accident_Limit = [500, 1000, 1500, 2000];

    @(defaultValue = "1000", domainComputation = false)
    int Bodily_Injury_Per_Accident_Limit = [500, 1000, 1500, 2000];

    @(defaultValue = "1000", domainComputation = false)
    int Limit = [1000, 2000, 5000, 10000, 25000, 50000];

    int Number_Of_Days = [1, 3, 5, 10, 15, 30];
    /*
    Constraint 5: A bundle of at least one car doesn't have Anti-Theft, at least one driver has accident point greater than 5, no medical payment coverage, and total price for product bundle over $100:
        - Must have BIPD coverage (see under AutoSilver)
        - Attribute: Property damage per Accident Limit of BIPD must be hidden
        - Value: $2000 of Bodily Injury Per Accident Limit of BIPD must be hidden 
    */
    boolean rootconstraint5 = parent(constraint5);
    rule(rootconstraint5, "hide", "attribute", "Property_Damage_Per_Accident_Limit");
    rule(rootconstraint5, "hide", "attribute", "Bodily_Injury_Per_Accident_Limit","value", 2000);

}

/*
Product: Medical Payments
@split = false: there is only one instance in the relationship. 
*/
@(split = false)
type MedicalPayments {
    @(defaultValue = "100", domainComputation = false)
    int Deductible = [0, 50, 100, 200, 500];

    int Property_Damage_Per_Accident_Limit = [500, 1000, 1500, 2000];

    int Bodily_Injury_Per_Person_Limit = [500, 1000, 1500, 2000];

    int Bodily_Injury_Per_Accident_Limit = [500, 1000, 1500, 2000];

    @(defaultValue = "1000", domainComputation = false)
    int Limit = [1000, 2000, 5000, 10000, 25000, 50000];

    int Number_Of_Days = [1, 3, 5, 10, 15, 30];

    @(tagName = "InputUnitPrice")
    decimal(2) inputUnitPrice;

}

/*
Product: Comprehensive
*/
@(split = false)
type Comprehensive {
    @(defaultValue = "100", domainComputation = false)
    int Deductible = [0, 50, 100, 200, 500];

    @(defaultValue = "1000", domainComputation = false)
    int Limit = [1000, 2000, 5000, 10000, 25000, 50000];

    int Number_Of_Days = [1, 3, 5, 10, 15, 30];

}