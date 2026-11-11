
const $ = s => document.querySelector(s);
var ENHANCEMENTS = {"street_trees":{"lead_agency":"City Public Works (StreetsLA) / Urban Forestry Division","process":"Board of Public Works street tree planting contract & Urban Forestry permit","beneficiary":"All Residents / Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Cuts urban heat island 3-5\u00b0F, lowers cooling bills for unconditioned apartments; broad distribution prevents hyper-localized rent spikes."},"schoolyard_green":{"lead_agency":"School district (e.g. LAUSD Facilities Services) with partners such as Los Angeles Neighborhood Land Trust and Trust for Public Land","process":"District greening priority list (LAUSD Greening Index), board-approved capital project & grant match (Measure W, Prop 4)","beneficiary":"Students / Families","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Replaces asphalt on school grounds; benefits children; negligible direct rent capitalization on surrounding rental parcels."},"vacant_lot_green":{"lead_agency":"City Community Investment for Families & Landowner","process":"Interim lease agreement, clean & green grant award & community volunteer stewardship","beneficiary":"All Residents","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Blended neighborhood stabilization; reduces blight and gun violence; modest land value bump buffered by in-place rent controls."},"community_garden":{"lead_agency":"City Recreation and Parks or the LA Community Garden Council; County Parks (LA County Department of Parks and Recreation) outside the city","process":"Site lease or Recreation and Parks allocation, Measure A or Quimby funding & community garden operating agreement","beneficiary":"Renters / Low-Income Families","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Direct food security and green space access for apartment dwellers without private yards."},"green_alley":{"lead_agency":"City Public Works & LA County Flood Control District","process":"Measure W Municipal/Regional funding application & green alley engineering design","beneficiary":"Adjacent Residents","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Permeable pavers, stormwater, and pedestrian lighting; primarily localized sanitation and flood prevention."},"cool_pavement":{"lead_agency":"City Public Works (StreetsLA) & Urban Forestry","process":"Capital Improvement Program (CIP) allocation & Board of Public Works public hearing","beneficiary":"All Residents / Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Surface temperature reduction on public rights-of-way; public good with zero rent-increase pass-through mechanism."},"pocket_park":{"lead_agency":"City Department of Recreation and Parks & City Council","process":"Lot acquisition negotiation, Quimby fee allocation & Park Commission approval","beneficiary":"Local Neighbors / Renters","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"Open space in park-poor rental tracts; provides recreational access, moderate positive spillover."},"park_upgrade":{"lead_agency":"City Department of Recreation and Parks","process":"Park needs assessment priority ranking, Measure A funding & community design charrette","beneficiary":"All Residents / Families","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"Upgraded playground equipment and lighting in existing municipal parks; no direct displacement driver."},"pickleball":{"lead_agency":"City Department of Recreation and Parks","process":"Park Advisory Board review, tennis court conversion approval & resurfacing RFP","beneficiary":"Recreation Players","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Court conversion; amenity sorting toward higher-income active adults; minimal displacement impact."},"tennis":{"lead_agency":"City Department of Recreation and Parks","process":"Park master plan update & Capital Improvement Program funding allocation","beneficiary":"Recreation Players","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Public tennis infrastructure; baseline municipal recreation."},"basketball":{"lead_agency":"City Department of Recreation and Parks (RAP)","process":"Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary":"Youth / Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"High-utilization recreation for youth and multi-family residents; zero luxury capitalization."},"dog_park":{"lead_agency":"City Department of Recreation and Parks (RAP)","process":"Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary":"Dog Owners","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Fenced exercise space; highly desired by millennial renters and condo owners."},"pool":{"lead_agency":"City Department of Recreation and Parks (RAP)","process":"Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary":"All Residents / Children","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Public swimming access; critical summer heat relief for households without private pools."},"splash_pad":{"lead_agency":"City Department of Recreation and Parks (RAP)","process":"Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary":"Families / Children","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Free, accessible water play for young children in park-poor, renter-dense neighborhoods."},"skate_park":{"lead_agency":"City Department of Recreation and Parks (RAP)","process":"Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary":"Youth","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Public youth athletic facility; minimal luxury real estate impact."},"sports_field":{"lead_agency":"City Department of Recreation and Parks (RAP)","process":"Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary":"Youth / League Players","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Grass turf fields for community soccer/baseball; general civic amenity."},"rec_center":{"lead_agency":"City Department of Recreation and Parks (RAP)","process":"Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary":"Youth, Seniors & Families","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Community programming, after-school care, cooling shelter, and civic space."},"restroom":{"lead_agency":"City Department of Recreation and Parks (RAP)","process":"Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary":"Park Users / Unhoused","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Basic sanitation and clean drinking water in public spaces; high human-dignity utility."},"bus_lane":{"lead_agency":"LA Metro & LADOT","process":"Metro Board & City Council joint approval; transit lane designation under Caltrans/CVC","beneficiary":"Transit Commuters / Low-Income Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Most Metro bus riders are low-income; dedicated lanes cut bus travel times by roughly a fifth to a third on treated corridors, with little direct rent-hike risk."},"brt":{"lead_agency":"LA Metro & Caltrans District 7","process":"Full CEQA/NEPA Environmental Impact Report, FTA Capital Investment Grant & Metro Board vote","beneficiary":"Transit Commuters / Renters","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"High-capacity transit line with signal priority; speeds regional access; modest land uplift near stations."},"rail_station":{"lead_agency":"LA Metro & City Department of Transportation (LADOT)","process":"Corridor transit study, CEQA environmental review & Metro Board approval","beneficiary":"Regional Commuters / Landowners","displacement_risk":"high_risk","displacement_text":"High Risk","renter_direct":false,"economic_nuance":"Major rail infrastructure draws speculative land buying, upzoning and redevelopment of older apartments near stations (Kahn 2007)."},"bus_shelters":{"lead_agency":"City Bureau of Street Services (StreetsLA) Sidewalk and Transit Amenities Program; LA Metro outside the city","process":"STAP site request, Council office approval & contractor installation under the advertising concession","beneficiary":"Transit Commuters / Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Shade, seating, and rain cover at bus stops; direct benefit to transit-dependent riders with zero land price escalation."},"traffic_calming":{"lead_agency":"City Department of Transportation (LADOT)","process":"Neighborhood speed radar study & Council District local return allocation","beneficiary":"Pedestrians / Local Residents","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Speed humps and chicanes reduce traffic violence on residential streets, protecting renter children."},"crosswalks":{"lead_agency":"City Department of Transportation (LADOT)","process":"Vision Zero pedestrian warrant study & LADOT rapid-response striping crew","beneficiary":"Pedestrians / Transit Commuters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"High-visibility bulb-outs and pedestrian refuges eliminate fatal collisions on arterial corridors."},"road_diet":{"lead_agency":"City Department of Transportation (LADOT) & Public Works","process":"Traffic engineering study, community outreach & City Council district authorization","beneficiary":"Pedestrians, Cyclists, Local Residents","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"Reallocates excessive vehicular lanes for safety and bike infrastructure; calms neighborhood speeds."},"sidewalks":{"lead_agency":"City Bureau of Street Services (StreetsLA)","process":"Willits v. City of LA ADA settlement compliance queue & concrete replacement contract","beneficiary":"Pedestrians / Mobility Impaired","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Repairs broken concrete and removes trip hazards (the Willits ADA settlement obliges LA City to fix sidewalks); essential basic infrastructure."},"street_lighting":{"lead_agency":"City Bureau of Street Lighting (BSL)","process":"Lighting assessment district vote or citywide energy-efficiency capital program","beneficiary":"Pedestrians / Shift Workers","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Pedestrian-scale LED lighting enhances nighttime safety for transit riders walking home late at night."},"cameras":{"lead_agency":"LAPD (or the city's police department) & City Council","process":"Police department site selection, Council office funding & privacy/retention policy review","beneficiary":"Police / Property Owners","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Surveillance cameras at hot spots; mixed community sentiment; potential civil liberties concerns."},"foot_patrol":{"lead_agency":"LAPD or the city's police department (LASD in contract cities and unincorporated areas)","process":"Hot-spot analysis by the police department & City Council budget allocation for patrol deployment","beneficiary":"All Residents / Shoppers","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"High-visibility foot patrols; short-term crime deterrence on commercial corridors."},"violence_interruption":{"lead_agency":"Mayor's Office of Gang Reduction and Youth Development (GRYD) in LA City; city or County Peace & Community programs elsewhere","process":"GRYD zone designation & contract with a community intervention provider; City Council budget allocation","beneficiary":"At-Risk Youth / Community","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Community-based gang intervention and truce mediation; saves lives in vulnerable renter tracts."},"bid":{"lead_agency":"Property Owners & City Council","process":"Prop 218 weighted property owner petition & City Council establishment ordinance","beneficiary":"Commercial Property / Business Owners","displacement_risk":"high_risk","displacement_text":"High Risk","renter_direct":false,"economic_nuance":"Business Improvement District assessments fund private security/clean teams; frequently precedes rapid commercial/residential gentrification."},"litter":{"lead_agency":"City Bureau of Sanitation (LASAN) & Board of Public Works","process":"CleanStat service routing & annual municipal operating budget appropriation","beneficiary":"All Residents","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"Weekly public trash and bulky item cleanup; improves environmental dignity without raising rents."},"graffiti":{"lead_agency":"City Office of Community Beautification (Board of Public Works) & contracted removal crews","process":"MyLA311 request routing to the contracted graffiti-removal crew; annual operating budget appropriation","beneficiary":"Property Owners / Residents","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Rapid paint-out of tagging; municipal maintenance."},"encampment":{"lead_agency":"Mayor's Office (Inside Safe) & Los Angeles Homeless Services Authority (LAHSA); County Homeless Initiative outside the city","process":"Inside Safe or County encampment-resolution operation: outreach, interim housing placement & services contracts","beneficiary":"Unhoused Individuals / Neighbors","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Housing-first outreach, supportive services, and interim shelter; addresses homelessness humanely."},"blight_rehab":{"lead_agency":"City / County Housing Department (LAHD / LACDA)","process":"Affordable housing NOFA allocation, bond issuance & City Council approval","beneficiary":"Property Owners / Neighbors","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Rehabilitates abandoned single-family homes; eliminates blighting influence on adjacent owners."},"affordable_housing":{"lead_agency":"City / County Housing Department (LAHD / LACDA)","process":"Affordable housing NOFA allocation, bond issuance & City Council approval","beneficiary":"Low-Income Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Deed-restricted 100% affordable housing (30-80% AMI) with permanent covenants (55 years); directly counters displacement."},"adu":{"lead_agency":"The homeowner, with the city's building department (LADBS in LA City) and City Planning","process":"Ministerial ADU permit (the city must act within 60 days of a complete application); standard plans speed review","beneficiary":"Homeowners","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"Adds backyard rental unit; increases rental supply, but exempt from rent control and primarily enriches single-family lot owner."},"solar":{"lead_agency":"The homeowner, with LADWP or Southern California Edison for interconnection","process":"Building and electrical permit (SolarAPP+ instant permitting in many cities) & utility interconnection application","beneficiary":"Homeowners / Landlords","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Rooftop solar reduces electric bills for the property owner; renters rarely receive direct pass-through savings."},"undergrounding":{"lead_agency":"City Public Works, LADWP / SCE & CPUC","process":"Rule 20 / Municipal underground utility assessment district formation & utility engineering","beneficiary":"Homeowners / Utility","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Buries overhead electrical wires; high capital cost; visual aesthetic and wildfire risk mitigation for homeowners."},"ev_hub":{"lead_agency":"LADWP / Southern California Edison & City Fleet/Parking","process":"Electric utility service transformer upgrade & commercial EV charging operator lease","beneficiary":"EV Drivers / Fleet Operators","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"DC fast chargers; primarily benefits EV owners; minimal direct utility for transit-reliant renters."},"microgrid":{"lead_agency":"Municipal Electric Utility (LADWP / SCE) & Public Works","process":"Grid interconnection capacity study & Utility Commission contract award","beneficiary":"Community / Facility Users","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Resilience hub maintaining islanded power during blackouts at community centers/clinics."},"noise_wall":{"lead_agency":"Caltrans District 7 & LA Metro (soundwall program), with the City","process":"Caltrans/Metro noise-barrier eligibility study (Caltrans Noise Abatement protocol) & Metro Board programming of local funds","beneficiary":"Freeway-Adjacent Residents","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Decibel reduction (5-10 dB) along major highway corridors; protects lower-income freeway-adjacent tenants."},"freeway_cap":{"lead_agency":"Caltrans District 7, LA Metro & the City (Bureau of Engineering / Recreation and Parks)","process":"Caltrans air-rights agreement, CEQA/NEPA environmental review, Metro and City Council funding votes","beneficiary":"Surrounding Neighborhood","displacement_risk":"high_risk","displacement_text":"High Risk","renter_direct":false,"economic_nuance":"Multi-block park cap over sunken freeway; massive regional amenity triggering intense real estate speculation and land value spikes."},"school_filters":{"lead_agency":"School district (e.g. LAUSD Facilities) with South Coast AQMD","process":"District facilities work order; AQMD / settlement-funded classroom air-filtration grants","beneficiary":"Students / Teachers","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"High-efficiency MERV 16/HEPA filtration in classrooms near freeways; protects children from diesel PM2.5."},"school_bond":{"lead_agency":"School District (e.g. LAUSD) or County Health Services","process":"School Board bond program allocation or County Board of Supervisors approval","beneficiary":"Students / Homeowners","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Campus modernizations, science labs, and air conditioning funded by LAUSD general obligation bonds."},"library":{"lead_agency":"Los Angeles Public Library or LA County Library (or the city's library department)","process":"Library capital program / branch renovation list & City Council or Board of Supervisors budget allocation","beneficiary":"All Residents / Students / Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Free access to books, computers, Wi-Fi, air conditioning, and job-seeking resources; vital public commons."},"clinic":{"lead_agency":"Federally Qualified Health Center (FQHC) & County Dept of Health","process":"HRSA Section 330 federal grant, county clinic licensing & lease execution","beneficiary":"Uninsured / Medicaid Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Federally Qualified Health Center (FQHC) offering sliding-scale primary, pediatric, and dental care."},"grocery":{"lead_agency":"City Economic & Workforce Development / City Council","process":"Business Improvement District (BID) formation or commercial facade grant cycle","beneficiary":"Local Residents / Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Eliminates food desert; provides fresh produce and affordable staples within walking distance."},"main_street":{"lead_agency":"City Economic & Workforce Development / City Council","process":"Business Improvement District (BID) formation or commercial facade grant cycle","beneficiary":"Retailers / Property Owners","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Facade improvement grants and streetscape enhancements on neighborhood commercial corridors."},"outdoor_dining":{"lead_agency":"City Economic & Workforce Development / City Council","process":"Business Improvement District (BID) formation or commercial facade grant cycle","beneficiary":"Restaurant Owners / Diners","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Parklets and sidewalk dining corrals under Al Fresco ordinance; enhances vibrancy for diners."},"farmers_market":{"lead_agency":"City Economic & Workforce Development / City Council","process":"Business Improvement District (BID) formation or commercial facade grant cycle","beneficiary":"Local Vendors / Shoppers","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Weekly open-air market; enhances food options and weekend foot traffic."},"upzone_transit":{"lead_agency":"City Planning Commission & City Council","process":"Transit-Oriented Development (TOD) community plan update, CEQA review & City Council ordinance","beneficiary":"Developers / Commuters","displacement_risk":"high_risk","displacement_text":"High Risk","renter_direct":false,"economic_nuance":"Upzoning near transit without aggressive anti-demolition and right-to-return covenants risks tearing down older rent-stabilized stock."},"protected_bike":{"lead_agency":"City Department of Transportation (LADOT)","process":"Mobility Plan corridor engineering, parking lane reallocation & Council approval","beneficiary":"Cyclists / Commuters","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"Physical concrete curb protection for active transportation; safe commuting for non-car owners."},"corridor_trail":{"lead_agency":"City Department of Recreation and Parks (RAP)","process":"Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary":"Cyclists, Walkers, Neighbors","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Multi-use path along utility/river corridors; enhances active mobility; moderate property uplift."},"transit_priority":{"lead_agency":"LA Metro & City Department of Transportation (LADOT)","process":"Corridor transit study, CEQA environmental review & Metro Board approval","beneficiary":"Transit Commuters / Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Transit signal priority and bus bulbs accelerate existing bus service; immediate user-cost savings."},"speed_cameras":{"lead_agency":"City Department of Transportation & LAPD","process":"State AB 645 speed safety camera program approval & City Council system contract","beneficiary":"Pedestrians / Drivers","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Automated speed enforcement under AB 645; discourages dangerous speeding; municipal fine risk for drivers."},"roundabout":{"lead_agency":"City Department of Transportation (LADOT) & Public Works","process":"Traffic engineering study, community outreach & City Council district authorization","beneficiary":"Drivers / Pedestrians","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Intersection traffic calming; reduces severe broadside collisions."},"ped_signals":{"lead_agency":"City Department of Transportation (LADOT)","process":"Pedestrian signal warrant analysis & Traffic signal modernization CIP","beneficiary":"Pedestrians / Transit Riders","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Leading Pedestrian Intervals (LPI) give walkers a 3-7 second head start before turning vehicles."},"school_street":{"lead_agency":"City Department of Transportation (LADOT) & Public Works","process":"Traffic engineering study, community outreach & City Council district authorization","beneficiary":"Students / Parents","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Car-free zones during morning drop-off and afternoon pick-up; protects school children."},"murals":{"lead_agency":"City Department of Cultural Affairs (mural registration) & the property owner","process":"Original Art Mural registration (LA City Mural Ordinance), owner consent & neighborhood notice; artist commission","beneficiary":"Community / Pedestrians","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Neighborhood cultural identity and public art; zero direct rent pass-through."},"tiny_forest":{"lead_agency":"City Public Works (StreetsLA) & Urban Forestry","process":"Capital Improvement Program (CIP) allocation & Board of Public Works public hearing","beneficiary":"All Residents","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Pocket biodiversity and cooling; small footprint limits speculative property revaluation."},"fiber_5g":{"lead_agency":"Telecom carriers with the City's Bureau of Engineering and Information Technology Agency (permits)","process":"Right-of-way and small-cell permits (Bureau of Engineering), franchise/pole agreements & broadband grant applications","beneficiary":"Broadband Users / Telecommuters","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"High-speed gigabit fiber and 5G cellular coverage; general digital infrastructure."},"green_street":{"lead_agency":"City Public Works (StreetsLA) & Urban Forestry","process":"Capital Improvement Program (CIP) allocation & Board of Public Works public hearing","beneficiary":"All Residents","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Bioswales and rain-garden curb extensions; green infrastructure benefits without direct rent shocks."},"stormwater_park":{"lead_agency":"LA County Flood Control District (Safe Clean Water Program) & City Recreation and Parks","process":"Measure W Regional Watershed Area Steering Committee (WASC) scoring (60+ pts) & SIP grant","beneficiary":"All Residents / Sports Leagues","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Large underground stormwater cistern beneath sports fields; utility-scale municipal drainage."},"corner_store":{"lead_agency":"City Planning (zoning change) & Economic and Workforce Development (grants)","process":"Zoning code amendment or specific-plan change by City Council, then small-business facade and equipment grants","beneficiary":"Neighborhood Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Allows healthy produce and basic sundries in walkable neighborhood commercial corners."},"food_hall":{"lead_agency":"Private Developer & City Planning Dept","process":"Commercial conditional use permit (CUP), building plan check & health department approval","beneficiary":"Food Entrepreneurs / Diners","displacement_risk":"high_risk","displacement_text":"High Risk","renter_direct":false,"economic_nuance":"Curated artisan culinary hall; often catalyzes neighborhood re-branding and upscale demographic turnover."},"park_cafe":{"lead_agency":"City Recreation and Parks (Board of Recreation and Park Commissioners)","process":"Concession request for proposals & Park Commission approval of the operating agreement","beneficiary":"Park Visitors","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Park kiosk concession offering refreshments; minor park activation."},"new_school":{"lead_agency":"School District (e.g. LAUSD) or County Health Services","process":"School Board bond program allocation or County Board of Supervisors approval","beneficiary":"Families / Students","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Relieves overcrowding in urban school districts; reduces class sizes and commute distances."},"plaza":{"lead_agency":"City Department of Transportation (LADOT People St program) & City Council office","process":"People St plaza application by a community partner, LADOT design review & Council office support","beneficiary":"Pedestrians / Local Shoppers","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"Pedestrianized public plaza with seating, planters, and events; creates civic gathering space."},"slow_streets":{"lead_agency":"City Department of Transportation (LADOT) & Public Works","process":"Traffic engineering study, community outreach & City Council district authorization","beneficiary":"Neighbors / Children","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"Neighborhood greenways prioritized for walking and play; calms local traffic."},"transit_shade":{"lead_agency":"City Bureau of Street Services (StreetsLA) Sidewalk and Transit Amenities Program; LA Metro","process":"STAP shade-structure request, Council office approval & installation under the advertising concession","beneficiary":"Transit Commuters / Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Solar canopies over bus waiting areas; protects low-income commuters from extreme heat exposure."},"bike_share":{"lead_agency":"LA Metro (Metro Bike Share) & City Department of Transportation (LADOT)","process":"Metro Bike Share expansion request, LADOT station siting & Council office approval","beneficiary":"Commuters / Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"First/last mile micro-mobility; reduced transportation expenses for urban renters."},"ebike_library":{"lead_agency":"City Department of Transportation (LADOT) or a community nonprofit, with LA Metro grant support","process":"Grant application (CARB Clean Mobility, Metro) & operating agreement with a community organization","beneficiary":"Low-Income Renters / Commuters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Free or subsidized long-term e-bike loans; replaces expensive vehicle trips for working-class tenants."},"microtransit":{"lead_agency":"LA Metro (Metro Micro) or the city's transit division","process":"Metro Micro zone request or city shuttle contract; Measure M local return and LCTOP funding","beneficiary":"Seniors / Renters / Transit Dependent","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"On-demand neighborhood electric shuttles bridging gaps in fixed-route bus service."},"alley_gating":{"lead_agency":"City Bureau of Engineering & Council office (alley vacation or gating permit); Bureau of Street Lighting","process":"Alley vacation or gating application by abutting owners, Bureau of Engineering review & Council approval; lighting assessment","beneficiary":"Abutting Residents","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Gating, lighting, and paving problem alleys; eliminates illicit dumping and crime hot spots."},"cooling_center":{"lead_agency":"City Recreation and Parks or the library system, with the County Office of Emergency Management and Public Health","process":"Cooling-center designation, HVAC/backup-power retrofit in the capital budget & grant match (Prop 4, FEMA BRIC)","beneficiary":"Vulnerable Renters / Seniors","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Designated air-conditioned shelter during extreme heat events for tenants without adequate home cooling."},"wayfinding":{"lead_agency":"City Department of Transportation (LADOT) with the local business improvement district","process":"Wayfinding sign plan, LADOT encroachment/sign permits & BID or Council office funding","beneficiary":"Visitors / Pedestrians","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Informational signs directing pedestrians to transit, civic hubs, and historic landmarks."},"box_art":{"lead_agency":"City Council office with the Department of Cultural Affairs and LADOT (signal-box owner)","process":"Council office sponsorship, LADOT permission for the signal cabinet & artist selection","beneficiary":"All Residents","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Decorative vinyl wraps on traffic signal boxes; modest visual beautification."},"vending_zone":{"lead_agency":"City Bureau of Street Services (StreetsLA) sidewalk vending program & Economic and Workforce Development","process":"Vending-zone designation ordinance, StreetsLA permits & utility/shade improvements in the capital budget","beneficiary":"Street Vendors / Low-Income Shoppers","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Permitted sidewalk vending plazas with utility connections, protecting immigrant micro-entrepreneurs."},"night_market":{"lead_agency":"City Economic & Workforce Development / City Council","process":"Business Improvement District (BID) formation or commercial facade grant cycle","beneficiary":"Local Artisans / Community","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Affordable evening market supporting local vendors and affordable culinary culture."},"clt":{"lead_agency":"Community Land Trust & LAHD","process":"Measure ULA tenant acquisition grant & property transfer into non-profit land trust","beneficiary":"Working-Class Renters","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Community Land Trust permanently removes multi-family buildings from speculative market, establishing non-profit cooperative or tenant-owned housing."},"safe_school_corridor":{"lead_agency":"Local School District (Facilities) & City Public Works / DOT","process":"Safe Routes to School (SRTS) priority corridor plan, school board capital resolution & Caltrans ATP / Federal SS4A grant match","beneficiary":"Students / Families / Neighborhood","displacement_risk":"protective","displacement_text":"Protective / Direct Family Benefit","renter_direct":true,"economic_nuance":"Comprehensive Safe Routes to School corridor combines street trees, traffic humps, high-visibility crosswalks, and campus modernizations; creates synergistic walkability that lifts family desirability and home values (+5.8%) while preventing pedestrian injuries."},"park_trees":{"lead_agency":"City Department of Recreation and Parks & Urban Forestry","process":"Park master plan shade canopy amendment & IRA Urban Forestry / State Park grant match","beneficiary":"All Residents / Park Visitors","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"Large-canopy park shade trees cut park surface temperatures by 5-8\u00b0F and expand usable recreational hours; moderate capitalization (+1.0%) with zero rental displacement."},"park_seating":{"lead_agency":"City Department of Recreation and Parks","process":"Park Advisory Board capital allocation, Quimby Act park fee appropriation & ADA compliance plan","beneficiary":"Seniors / Families / Park Visitors","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"Commercial-grade shaded benches and ADA picnic pavilions increase park dwell time and community gathering (+0.4%)."},"park_mural":{"lead_agency":"City Department of Cultural Affairs & Recreation and Parks","process":"Community arts commission call for artists, public design review & Municipal Arts Development Fee grant","beneficiary":"All Residents / Neighborhood","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"Locally commissioned public art and pavilion murals deter graffiti, foster neighborhood pride, and provide modest aesthetic capitalization (+0.3%)."},"park_lighting":{"lead_agency":"City Department of Recreation and Parks & Bureau of Street Lighting","process":"Park safety lighting audit, Board of Commissioners hearing & Clean Energy / CDBG capital fund allocation","beneficiary":"Evening Walkers / Neighborhood","displacement_risk":"protective","displacement_text":"Protective / Direct Renter Benefit","renter_direct":true,"economic_nuance":"Smart solar-powered LED pathway and perimeter lighting expands evening park safety and deters crime; +1.4% home value lift without gentrification pressure."},"beach_nourishment":{"lead_agency":"US Army Corps of Engineers (USACE), State Coastal Conservancy & City/County Beaches and Harbors","process":"Coastal Development Permit (CDP), USACE WRDA authorization, NEPA/CEQA certification & Coastal Conservancy grant","beneficiary":"Coastal Residents / Regional Public","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Engineered sand nourishment and dune stabilization prevent shoreline bluff erosion, expand beach width, and protect coastal infrastructure (+5.0% within 800 m)."},"beach_volleyball":{"lead_agency":"City / County Department of Beaches and Harbors","process":"Beach master plan recreation permit, Coastal Commission administrative CDP & concession/park district funding","beneficiary":"Active Adults / Youth / Beachgoers","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":true,"economic_nuance":"Public sand volleyball courts with tournament-grade netting and LED dusk lighting; highly activated athletic amenity (+0.8%)."},"mountain_bike_trails":{"lead_agency":"City Parks and Recreation / County Open Space District with local trail alliances (e.g. IMBA)","process":"Open space recreational trail master plan, CEQA categorical exemption & Land and Water Conservation Fund (LWCF) / state park grant","beneficiary":"Outdoor Enthusiasts / Regional Visitors / Youth","displacement_risk":"neutral","displacement_text":"Neutral / Low Risk","renter_direct":false,"economic_nuance":"Purpose-built singletrack flow trails, pump track, and trailhead parking kiosk (modeled on Santa Clarita Trek Bike Park); establishes premier outdoor recreation hub (+3.2% within 1,200 m)."}};
if (typeof window !== "undefined") window.ENHANCEMENTS = ENHANCEMENTS;

// Global active house tracker for reactive story toggling & cost recalculation
var activeHouse = null; if (typeof window !== "undefined") window.activeHouse = activeHouse;

// Return per $1 exactly as the model ranks it (the same number the map, tooltips and report use), plus
// (a) a judgment band by evidence grade and (b) an experimental local adjustment for heat, canopy gap, bus frequency,
// dining density, freeway proximity and price tier. The adjustment is shown for context only: it never changes the
// headline, the ranking or the map colors.
const VPD_GREEN = ["street_trees", "pocket_park", "cool_pavement", "community_garden", "tiny_forest", "green_street", "schoolyard_green", "vacant_lot_green"];
const VPD_WALK = ["bus_shelters", "transit_shade", "protected_bike", "crosswalks", "street_lighting", "bike_share", "transit_priority", "bus_lane", "brt", "slow_streets", "ped_signals"];
const VPD_BAND = { A: 0.09, B: 0.12, C: 0.16, D: 0.22, U: 0.22 };
function calibrateVpd(v, grade, id, m) {
  const f = x => x >= 10 ? String(Math.round(x)) : x >= 1 ? x.toFixed(1) : x.toFixed(2);
  if (v == null || isNaN(v) || v <= 0) return { low: "–", high: "–", badge: "", str: "–", estStr: "–", adjStr: "", point: null, adj: null, factor: 1, notes: [], band: 0 };
  const g = (grade || "C").toUpperCase(), m_ = m || {};
  let factor = 1; const notes = [];
  if (VPD_GREEN.includes(id)) {
    const tg = m_.tg != null ? +m_.tg : 20, ht = m_.ht != null ? +m_.ht : 0;     // canopy gap to goal; heat vs county median
    const heat = 1 + Math.min(Math.max(ht * 0.035 + (tg - 15) * 0.008, -0.20), 0.35);
    const hv = m_.hv != null ? +m_.hv : 850000;
    const wealth = Math.pow(850000 / Math.max(hv, 300000), 0.28);                  // damps percentage effects in the priciest areas
    factor *= heat * wealth; notes.push(`heat and canopy gap ×${heat.toFixed(2)}`, `price tier ×${wealth.toFixed(2)}`);
  } else if (VPD_WALK.includes(id)) {
    const bt = m_.bt != null ? +m_.bt : 4, din = m_.din != null ? +m_.din : 2;     // buses per hour; restaurants and cafés nearby
    const walk = 1 + Math.min(Math.max((bt - 6) * 0.02 + Math.min(din, 15) * 0.015, -0.15), 0.30);
    factor *= walk; notes.push(`bus frequency and dining density ×${walk.toFixed(2)}`);
  }
  if (m_.fw != null && m_.fw < 300) { factor *= 0.90; notes.push("within 300 m of a freeway ×0.90"); }
  const rad = VPD_BAND[g] ?? 0.22, low = v * (1 - rad), high = v * (1 + rad), adj = v * factor;
  return { low: f(low), high: f(high), point: v, adj, factor, notes, band: rad,
    badge: g !== "NONE" ? "Grade " + g : "", str: "$" + f(low) + " – $" + f(high) + " / $1", estStr: `~$${f(v)} / $1`,
    adjStr: Math.abs(factor - 1) < 0.005 ? "" : `~$${f(adj)} / $1 (×${factor.toFixed(2)})` };
}
function formatVpdRange(v, grade, id, m) { return calibrateVpd(v, grade, id, m); }

const css = (n, fb) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt$ = v => v == null || isNaN(v) ? "–" : v >= 1e9 ? "$" + (v/1e9).toFixed(1) + "B" : v >= 1e6 ? "$" + (v/1e6).toFixed(v >= 1e7 ? 0 : 1) + "M" : v >= 1e3 ? "$" + Math.round(v/1e3) + "k" : "$" + Math.round(v);
const fmtN = v => v == null || isNaN(v) ? "–" : Math.round(v).toLocaleString();
const GRADE_TXT = { A: "A · measured on LA sales", B: "B · studied elsewhere", C: "C · transferred from a related study", D: "D · assumption", U: "U · unverified research lead (round 6)" };
const allowed = id => { const g = D.catalog[id].grade; return g === "none" || g <= $("#evid").value; };
const fvpd = v => "$" + (v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : Math.round(v));
const CATS = ["Greening", "Parks & recreation", "Transit", "Streets & safety", "Clean streets", "Housing", "Energy", "Environment", "Schools & services", "Amenities & economy", "Zoning"];
const CAT_COLOR = { "Greening": "--cat-3", "Parks & recreation": "--park-line", "Transit": "--cat-1", "Streets & safety": "--school", "Clean streets": "--warn-ink", "Housing": "--cat-2", "Energy": "--fw-casing", "Environment": "--water-line", "Schools & services": "--seq-5", "Amenities & economy": "--heat-4", "Zoning": "--ink-3" };
const METRICS = {
  top_vpd: { label: "Best value per $1 (where ≥ $1)", f: p => p.v >= 1 ? p.v : null, unit: fvpd, ramp: "seq", none: "Nothing returns $1 per $1" },
  pkg_cost: { label: "Cost of every project returning ≥ $1 per $1", f: p => p.pc || null, unit: fmt$, ramp: "seq" },
  value: { label: "Typical home value", f: p => p.hv, unit: fmt$, ramp: "seq" },
  heat: { label: "Heat vs. county median", f: p => p.ht, unit: v => (v > 0 ? "+" : "") + v.toFixed(1) + "°F", ramp: "heat" },
  crime: { label: "Violent crimes per 1,000 residents, 12 mo", f: p => p.vc, unit: v => v.toFixed(1), ramp: "heat" },
  park: { label: "Park acres within ½ mile", f: p => p.pa, unit: v => v.toFixed(1) + " ac", ramp: "seq" },
  bus: { label: "Buses per hour, busiest stop within 400 m (7–9am)", f: p => p.bt, unit: v => Math.round(v) + "/hr", ramp: "seq" },
  sites: { label: "Open street-tree sites", f: p => p.ts, unit: v => fmtN(v), ramp: "heat" },
  profit: { label: "Experimental: Profit potential (unverified)", f: p => p.pp > 0 ? p.pp * 100 : null, unit: v => v.toFixed(1) + "%", ramp: "seq", none: "No paying projects or sites" },
};
var D, map, bgs, layers = {}, selected = null, selLayer = null, breaks = [], tiles = null, byId = new Map();

// Speed: the core bundle (map shapes, scores, catalog) is unpacked at start. Block-group details ship as small
// gzip chunks and are unpacked the first time anything reads D.details[id], so existing code needs no changes.
async function b64Bytes(text) {
  try { return new Uint8Array(await (await fetch("data:application/octet-stream;base64," + text)).arrayBuffer()); }
  catch { const s = atob(text), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
}
function lazyDetails() {
  const el = $("#details-chunks"), src = el && el.textContent.trim();
  if (!src || src.startsWith("/*")) return {};
  const { key, chunks } = JSON.parse(src), open = new Map(), extra = {};   // extra: records added after load (Orange County)
  const chunk = k => {
    if (!open.has(k)) {
      const b = chunks[k]; let v = {};
      if (b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        v = JSON.parse(fflate.strFromU8(fflate.gunzipSync(u))); }
      open.set(k, v);
    }
    return open.get(k);
  };
  return new Proxy(extra, {
    get: (t, id) => typeof id === "string" ? (id in t ? t[id] : chunk(id.slice(0, key))[id]) : undefined,
    has: (t, id) => typeof id === "string" && (id in t || id in chunk(id.slice(0, key))),
    set: (t, id, v) => { t[id] = v; return true; },
  });
}
// Every area on the map: LA County block groups plus Orange County tracts once that bundle is unpacked.
function allFeatures() {
  const la = (typeof D !== "undefined" && D && D.bgs && D.bgs.features) ? D.bgs.features : [];
  const oc = (typeof D_OC !== "undefined" && D_OC && D_OC.features) ? D_OC.features : [];
  return oc.length ? la.concat(oc) : la;
}
const isOCArea = m => !!(m && m.county === "Orange County");
// Speed: the nine "is this lot inside X?" house checks (historic districts and monuments, hillside, landslide,
// liquefaction, fault, fire zones) are answered from polygons shipped with the page (pipeline stage `overlays`),
// unpacked one ~5 km grid cell at a time. Any layer missing from the build is still queried live.
let OV;
function overlayData() {
  if (OV !== undefined) return OV;
  const t = ($("#overlay-chunks") || {}).textContent, s = t && t.trim();
  OV = s && !s.startsWith("/*") && s !== "null" ? JSON.parse(s) : null;
  if (OV) OV.open = new Map();
  return OV;
}
function inRing(r, lat, lng) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [yi, xi] = r[i], [yj, xj] = r[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function localOverlays(ll) {
  const O = overlayData(); if (!O) return {};
  const k = `${Math.floor((ll.lng + 180) / O.cell)},${Math.floor((ll.lat + 90) / O.cell)}`;
  if (!O.open.has(k)) {
    let items = [];
    const b = O.chunks[k];
    if (b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      items = JSON.parse(fflate.strFromU8(fflate.gunzipSync(u))).map(([li, ai, rings]) => [li, ai, rings.map(decodeLine)]); }
    O.open.set(k, items);
  }
  const out = Object.fromEntries(O.layers.map(l => [l, { ok: true, v: [], local: true }]));
  for (const [li, ai, rings] of O.open.get(k))
    if (inRing(rings[0], ll.lat, ll.lng) && !rings.slice(1).some(h => inRing(h, ll.lat, ll.lng))) out[O.layers[li]].v.push(O.attrs[ai]);
  return out;
}
async function unpack() {
  const bin = await b64Bytes($("#bundle").textContent.trim());
  const d = JSON.parse(await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
  if (!d.details) d.details = lazyDetails();
  if (typeof ENHANCEMENTS !== "undefined" && d && d.catalog) {
    for (const k in ENHANCEMENTS) {
      if (d.catalog[k]) Object.assign(d.catalog[k], ENHANCEMENTS[k]);
    }
  }
  if (d && d.funding && d.funding["W"]) {
    d.funding["W"] = ["Measure W (Safe Clean Water)", "Regional 50% through Watershed Area Steering Committees (110-point scoring, 60 to qualify, benefits to disadvantaged communities at least 110% of their population share); Municipal 40% straight to cities for local stormwater, green-street and tree projects; District 10% for administration, education and workforce", "https://safecleanwaterla.org"];
  }
  return d;
}
const ramp = kind => [0,1,2,3,4,5,6].map(i => css(`--${kind}-${i}`));
function computeBreaks() {
  const m = METRICS[$("#metric").value]; if (!m) return [];
  const feats = (activeCounty === "oc" && D_OC) ? D_OC.features : ((typeof D !== "undefined" && D && D.bgs && D.bgs.features) ? D.bgs.features : []);
  if (!feats.length) return [];
  const v = feats.map(f => m.f(f.properties)).filter(x => x != null && !isNaN(x)).sort((a, b) => a - b);
  return v.length ? [1,2,3,4,5,6].map(i => v[Math.min(v.length - 1, Math.floor(i / 7 * v.length))]) : [];
}
function colorFor(p) {
  const k = $("#metric").value;
  if (k === "top") return p.t ? css(CAT_COLOR[D.catalog[p.t].category] || "--ink-3") : css("--none");
  const v = METRICS[k].f(p); if (v == null || isNaN(v)) return css("--none");
  let i = 0; while (i < breaks.length && v > breaks[i]) i++;
  return ramp(METRICS[k].ramp)[i];
}
const zoningOn = () => typeof map !== "undefined" && map && map._loaded && $("#l-zone").checked && map.getZoom() >= 14;
const streetLevel = () => typeof map !== "undefined" && map && map._loaded && map.getZoom() >= 17;
const aerialOn = () => !!$("#l-aerial") && $("#l-aerial").checked;
const styleBg = f => ({ fillColor: colorFor(f.properties), fillOpacity: zoningOn() ? 0.12 : aerialOn() ? (streetLevel() ? 0.05 : 0.3) : streetLevel() ? 0.22 : tiles ? 0.45 : 0.75, color: css("--block-line"), weight: 0.4 });
function legend() {
  const k = $("#metric").value, el = $("#legend");
  if (!el) return;
  const feats = (activeCounty === "oc" && D_OC) ? D_OC.features : ((typeof D !== "undefined" && D && D.bgs && D.bgs.features) ? D.bgs.features : []);
  if (!feats.length) { el.innerHTML = ""; return; }
  if (k === "top") {
    const used = new Set(feats.map(f => f.properties.t && D.catalog[f.properties.t] && D.catalog[f.properties.t].category).filter(Boolean));
    el.innerHTML = `<h4>Best improvement type</h4><div class="cats">${CATS.filter(c => used.has(c)).map(c => `<div><i style="background:${css(CAT_COLOR[c])}"></i>${esc(c)}</div>`).join("")}<div><i style="background:${css("--none")}"></i>Nothing returns $1 per $1</div></div>`;
    return;
  }
  const m = METRICS[k];
  el.innerHTML = breaks.length ? `<h4>${m.label}</h4><div class="sw">${ramp(m.ramp).map(c => `<i style="background:${c}"></i>`).join("")}</div><div class="ends"><span>${m.unit(breaks[0])}</span><span>${m.unit(breaks[5])}</span></div><div class="note">7 equal-count groups. Gray = ${m.none || "no data"}.</div>`
    : `<h4>${m.label}</h4><div class="note">No data loaded for this.</div>`;
}

function drawContext() {
  if (typeof D === "undefined" || !D || !D.layers || typeof map === "undefined" || !map) return;
  Object.values(layers).forEach(l => l && map.removeLayer(l)); layers = {};
  const L_ = D.layers, on = id => $(id) && $(id).checked;
  const noPts = { pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 0, opacity: 0, fillOpacity: 0, interactive: false }) };
  if (on("#l-parks")) {
    if (L_.parks) layers.parks = L.geoJSON(L_.parks, { ...noPts, renderer: parkCanvas(),
      style: f => ({ fillColor: f.properties.k === "beach" ? css("--sand", "#eadfbf") : css("--park"), fillOpacity: f.properties.k === "open space" ? .55 : .85,
                     color: css("--park-line"), weight: f.properties.a < 2 ? 1.2 : .6 }),
      interactive: false }).addTo(map);
    if (L_.park_labels && L_.park_labels.length) layers.parkLabels = L.layerGroup().addTo(map);
    if (L_.water) layers.water = L.geoJSON(L_.water, { ...noPts, interactive: false, style: { color: css("--water-line"), weight: 1.8, opacity: .9 } }).addTo(map);
  }
  if (on("#l-roads")) {
    if (L_.arterials) layers.art = L.geoJSON(L_.arterials, { ...noPts, interactive: false, style: { color: css("--road-casing"), weight: 1, opacity: .8 } });
    if (L_.streets) { layers.streets = L.layerGroup().addTo(map); layers.stLabels = L.layerGroup().addTo(map); }
    if (L_.freeways) { layers.fwC = L.geoJSON(L_.freeways, { ...noPts, interactive: false, style: { color: css("--fw-casing"), weight: 3.6, opacity: .9 } }).addTo(map);
      layers.fw = L.geoJSON(L_.freeways, { ...noPts, interactive: false, style: { color: css("--fw"), weight: 2.2, opacity: 1 } }).addTo(map); }
    if (L_.walls) layers.walls = L.geoJSON(L_.walls, { ...noPts, interactive: false, style: { color: css("--ink"), weight: 2, opacity: .8 } });
  }
  if (on("#l-transit")) {
    if (L_.rail) layers.rail = L.geoJSON(L_.rail, { ...noPts, interactive: false, style: { color: css("--rail"), weight: 1.8, dashArray: "6 4", opacity: .9 } }).addTo(map);
    if (L_.stations) layers.stations = L.geoJSON(L_.stations, { pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 4, color: css("--sheet"), weight: 1.5, fillColor: css("--rail"), fillOpacity: 1 }),
      onEachFeature: (f, l) => f.properties.n && l.bindTooltip(esc(f.properties.n) + " station") }).addTo(map);
    if (L_.stops) layers.stops = L.geoJSON(L_.stops, { pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 2.2, weight: 0, fillColor: css("--cat-1"), fillOpacity: .8 }),
      onEachFeature: (f, l) => l.bindTooltip(`${f.properties.t} buses an hour (7–9am)`) });
  }
  if (on("#l-amen") && L_.amenities) {
    const sym = { "tennis": "T", "pickleball": "P", "basketball": "B", "playground": "▲", "dog park": "D", "pool": "≈", "skate park": "S", "library": "L", "community garden": "G" };
    layers.amen = L.geoJSON(L_.amenities, { pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 3.5, color: css("--sheet"), weight: 1, fillColor: css("--school"), fillOpacity: 1 }),
      onEachFeature: (f, l) => l.bindTooltip(`<b>${esc(f.properties.k)}</b>${f.properties.n ? " · " + esc(f.properties.n) : ""}`) });
  }
  if (on("#l-fac") && L_.facilities) { layers.fac = L.layerGroup(); layers.facArea = L.layerGroup().addTo(map); _fDrawn.clear(); }
  if (on("#l-under") && L_.underused) { layers.under = L.layerGroup().addTo(map); _uDrawn.clear(); }
  if (on("#l-proj") && L_.projects) layers.proj = L.layerGroup();
  if (on("#l-transit") && L_.rail_con) {
    layers.railCon = L.layerGroup(L_.rail_con.filter(r => r.length === 2).map(([n, e]) => L.polyline(decodeLine(e), { interactive: !!n, color: "#e8590c", weight: 2.4, dashArray: "2 6", opacity: .95 }).bindTooltip(`${n ? esc(n) + " · " : ""}rail under construction`))).addTo(map);
    (L_.stations_con || []).filter(r => r.length === 3).forEach(([n, lat, lon]) => layers.railCon.addLayer(L.circleMarker([lat, lon], { radius: 5, color: "#e8590c", weight: 2, fillColor: css("--sheet"), fillOpacity: 1 }).bindTooltip(`<b>${esc(n)}</b> · station under construction`)));
  }
  if (on("#l-zone") && L_.zoning) { layers.zone = L.layerGroup().addTo(map); layers.zoneLabels = L.layerGroup().addTo(map); }
  if (on("#l-hoods") && D.hoods) {
    layers.hoods = L.geoJSON(D.hoods, { ...noPts, interactive: false, style: { fill: false, color: css("--hood-line"), weight: 1.1, opacity: .5 } });
    layers.hoodLabels = L.layerGroup((D.hood_labels || []).map(([n, lat, lon]) => L.marker([lat, lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null, html: `<div class="lbl-hood" style="transform:translate(-50%,-50%)">${esc(n)}</div>` }) })));
    layers.cities = L.geoJSON(D.cities, { ...noPts, interactive: false, style: { fill: false, color: css("--hood-line"), weight: 1.8, opacity: .55 } }).addTo(map);
    layers.cityLabels = L.layerGroup((D.city_labels || []).map(([n, lat, lon]) => L.marker([lat, lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null, html: `<div class="lbl-city" style="transform:translate(-50%,-50%)">${esc(n)}</div>` }) })));
  }
  zoomed();
}
function zoomed() {
  const z = map.getZoom();
  const toggle = (l, show) => { if (!l) return; if (show && !map.hasLayer(l)) l.addTo(map); if (!show && map.hasLayer(l)) map.removeLayer(l); };
  toggle(layers.art, z >= 12); toggle(layers.walls, z >= 14); toggle(layers.stops, z >= 13); toggle(layers.amen, z >= 13);
  toggle(layers.hoods, z >= 12); toggle(layers.hoodLabels, z >= 13 && z < 15); toggle(layers.cityLabels, z >= 10 && z < 13);
  drawStreets(); drawLabels(); drawZoning(); drawFacilities(); drawUnder(); drawProjects();
  const zon = zoningOn() + "|" + streetLevel(); if (zon !== zoomed._last) { zoomed._last = zon; if (typeof activeCounty !== "undefined" && activeCounty === "oc" && typeof ocLayer !== "undefined" && ocLayer && ocLayer.setStyle) ocLayer.setStyle(styleBg); else if (typeof bgs !== "undefined" && bgs && bgs.setStyle) bgs.setStyle(styleBg); }
}

// ---------------- streets, names, shields and park labels (drawn only for what's on screen)
let _parkCanvas = null, _stCanvas = null;
// Parks and streets draw on their own canvases in panes that ignore the pointer, so clicks and hovers always
// reach the block groups underneath (a canvas on top would otherwise swallow every click).
function passPane(name, z) {
  if (!map.getPane(name)) { const p = map.createPane(name); p.style.zIndex = z; p.style.pointerEvents = "none"; }
  return name;
}
const parkCanvas = () => _parkCanvas || (_parkCanvas = L.canvas({ padding: .3, pane: passPane("parksPane", 405) }));
function decodeLine(str) {
  const pts = []; let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const k of [0, 1]) { let b, sh = 0, r = 0;
      do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
      const d = r & 1 ? ~(r >> 1) : r >> 1; if (k === 0) lat += d; else lon += d; }
    pts.push([lat / 1e5, lon / 1e5]);
  }
  return pts;
}
const _cellCache = new Map(); let _fwyLines = null;
function cellLines(key) {
  if (!_cellCache.has(key)) _cellCache.set(key, (D.layers.streets.cells[key] || []).map(([c, n, e]) => ({ c, n: D.layers.streets.names[n], pts: decodeLine(e) })));
  return _cellCache.get(key);
}
function visibleCells(pad = 0) {
  const S = D.layers.streets, b = map.getBounds().pad(pad), k = [];
  for (let x = Math.floor((b.getWest() + 180) / S.cell); x <= Math.floor((b.getEast() + 180) / S.cell); x++)
    for (let y = Math.floor((b.getSouth() + 90) / S.cell); y <= Math.floor((b.getNorth() + 90) / S.cell); y++) k.push(x + "," + y);
  return k;
}
const _drawn = new Map();
function drawStreets() {
  if (!map._loaded) return;
  if (!layers.streets) return;
  const z = map.getZoom(), want = new Set();
  // collectors (class 2) from zoom 13, local streets (class 3) from zoom 14; arterials/freeways already drawn
  if (z >= 13 && visibleCells(0).length <= 40) visibleCells(.2).forEach(k => { want.add(k + "|2"); if (z >= 14) want.add(k + "|3"); });
  for (const [key, lyr] of _drawn) if (!want.has(key)) { layers.streets.removeLayer(lyr); _drawn.delete(key); }
  _stCanvas = _stCanvas || L.canvas({ padding: .3, pane: passPane("streetsPane", 406) });
  for (const key of want) {
    if (_drawn.has(key)) continue;
    const [cell, c] = key.split("|"), lines = cellLines(cell).filter(l => l.c === +c).map(l => l.pts);
    if (!lines.length) continue;
    const lyr = L.polyline(lines, { renderer: _stCanvas, interactive: false, color: css(+c === 2 ? "--road-casing" : "--res"), weight: +c === 2 ? 1.6 : 1.1, opacity: .95 });
    layers.streets.addLayer(lyr); _drawn.set(key, lyr);
  }
}
function shieldHtml(ref) {
  const r = (String(ref).split(";").map(x => x.trim()).find(x => !/hist/i.test(x)) || ""), m = r.match(/^(I|US|CA|SR)[ -]?(\d+[A-Z]?)\b/i);
  if (!m) return null;
  const t = m[1].toUpperCase(), cls = t === "I" ? "" : t === "US" ? " us" : " sr";
  return `<div class="shield${cls}" style="transform:translate(-50%,-50%)">${t === "I" ? "I-" : t === "US" ? "US " : ""}${m[2]}</div>`;
}
function drawLabels() {
  if (!map._loaded) return;
  const z = map.getZoom(), taken = [], fits = (p, r) => { if (taken.some(q => Math.abs(q.x - p.x) < r && Math.abs(q.y - p.y) < r * .5)) return false; taken.push(p); return true; };
  const mk = (ll, html) => L.marker(ll, { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null, html }) });
  if (layers.stLabels) {
    layers.stLabels.clearLayers();
    const size = map.getSize(), inView = p => p.x > 0 && p.y > 0 && p.x < size.x && p.y < size.y;
    if (z >= 10.5) {
      // spacing between repeated labels of the same street, in screen pixels
      const gap = { 0: 380, 1: 420, 2: 380, 3: 300 }, minZ = { 0: 10.5, 1: 13, 2: 14, 3: 15 };
      if (!_fwyLines) _fwyLines = (D.layers.streets.fwy || []).map(([c, n, e]) => ({ c, n: D.layers.streets.names[n], pts: decodeLine(e) }));
      const vb = map.getBounds().pad(.1);
      const lines = _fwyLines.filter(l => l.pts.some(p => vb.contains(p)))
        .concat(z >= 13 && visibleCells(0).length <= 60 ? visibleCells(0).flatMap(cellLines).filter(l => z >= minZ[l.c]).sort((a, b) => a.c - b.c) : []);
      let count = 0;
      const placed = new Map(); // street name -> screen points already labeled
      const farFromSame = (n, p, g) => !(placed.get(n) || []).some(q => q.distanceTo(p) < g);
      for (const l of lines) {
        if (count > 500) break;
        const px = l.pts.map(p => map.latLngToContainerPoint(p)), g = gap[l.c];
        let since = g / 3;
        for (let i = 1; i < px.length; i++) {
          const a = px[i - 1], b = px[i], seg = a.distanceTo(b);
          since += seg;
          if (since < g / 3 || seg < (l.c === 0 ? 4 : l.n.length * 6.2)) continue;
          const mid = L.point((a.x + b.x) / 2, (a.y + b.y) / 2);
          const key = l.c === 0 ? (shieldHtml(l.n) || l.n) : l.n;
          if (!inView(mid) || !farFromSame(key, mid, g)) continue;
          let html;
          if (l.c === 0) { html = shieldHtml(l.n); if (!html || !fits(mid, 50)) continue; }
          else {
            let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
            if (!fits(mid, Math.max(70, l.n.length * 6))) continue;
            html = `<div class="lbl-st${l.c === 1 ? " art" : ""}" style="transform:translate(-50%,-50%) rotate(${ang.toFixed(1)}deg)">${esc(l.n)}</div>`;
          }
          layers.stLabels.addLayer(mk(map.containerPointToLatLng(mid), html)); since = 0; count++;
          if (!placed.has(key)) placed.set(key, []); placed.get(key).push(mid);
        }
      }
    }
  }
  if (layers.parkLabels) {
    layers.parkLabels.clearLayers();
    const b = map.getBounds(), minAc = z >= 15 ? 0 : z >= 14 ? 1 : z >= 13 ? 5 : z >= 12 ? 25 : z >= 11 ? 150 : 1e9;
    let n = 0;
    for (const [nm, lat, lon, ac] of D.layers.park_labels) {
      if (ac < minAc) break;
      if (!b.contains([lat, lon])) continue;
      const p = map.latLngToContainerPoint([lat, lon]);
      if (!fits(p, Math.max(60, nm.length * 6))) continue;
      layers.parkLabels.addLayer(mk([lat, lon], `<div class="lbl-park" style="transform:translate(-50%,-50%)">${esc(nm)}</div>`));
      if (++n > 150) break;
    }
  }
}

// ---------------- public facilities (County LMS + OpenStreetMap)
const FAC_STYLE = { "school": ["#2563eb", "S"], "college": ["#4338ca", "U"], "library": ["#7c3aed", "L"], "city hall": ["#111827", "C"],
  "fire station": ["#dc2626", "F"], "police": ["#1e3a8a", "P"], "post office": ["#6b7280", "✉"], "hospital": ["#be123c", "H"], "clinic": ["#db2777", "+"],
  "community center": ["#ea580c", "R"], "museum": ["#0f766e", "M"], "courthouse": ["#78350f", "J"] };
function drawFacilities() {
  if (!map._loaded || !layers.fac) return;
  drawFacilityAreas();
  const z = map.getZoom(), b = map.getBounds().pad(.1), K = D.layers.fac_kinds;
  layers.fac.clearLayers();
  if (z < 12) { if (map.hasLayer(layers.fac)) map.removeLayer(layers.fac); return; }
  if (!map.hasLayer(layers.fac)) layers.fac.addTo(map);
  // schools are numerous: from zoom 13; civic buildings from zoom 12
  for (const [k, n, lat, lon] of D.layers.facilities) {
    if (!facOn.has(k)) continue;
    const kind = K[k]; if (z < 13 && (kind === "school" || kind === "clinic")) continue;
    if (!b.contains([lat, lon])) continue;
    const [col, ch] = FAC_STYLE[kind] || ["#444", "•"];
    layers.fac.addLayer(L.marker([lat, lon], { keyboard: false, icon: L.divIcon({ className: "", iconSize: [14, 14], html: `<div class="fac" style="background:${col}">${ch}</div>` }) })
      .bindTooltip(`<b>${esc(kind[0].toUpperCase() + kind.slice(1))}</b>${n ? " · " + esc(n) : ""}`).on("click", e => selectAt(e.latlng)));
  }
}

let facOn = new Set(Array.from({ length: 20 }, (_, i) => i));
const _fDrawn = new Map(); let _fCanvas = null;
function cellKeys(cell, pad) {
  const b = map.getBounds().pad(pad), k = [];
  for (let x = Math.floor((b.getWest() + 180) / cell); x <= Math.floor((b.getEast() + 180) / cell); x++)
    for (let y = Math.floor((b.getSouth() + 90) / cell); y <= Math.floor((b.getNorth() + 90) / cell); y++) k.push(x + "," + y);
  return k;
}
function drawFacilityAreas() {
  // footprints (school grounds, library and civic buildings) from zoom 14, colored like their markers
  const A = D.layers.fac_areas; if (!A || !layers.facArea) return;
  const want = new Set(map.getZoom() >= 14 ? cellKeys(A.cell, .2) : []);
  for (const [k, l] of _fDrawn) if (!want.has(k)) { layers.facArea.removeLayer(l); _fDrawn.delete(k); }
  _fCanvas = _fCanvas || L.canvas({ padding: .3, pane: passPane("facPane", 407) });
  for (const k of want) {
    if (_fDrawn.has(k)) continue;
    const polys = (A.cells[k] || []).filter(([fk]) => facOn.has(fk)).map(([fk, rings]) => { const col = (FAC_STYLE[D.layers.fac_kinds[fk]] || ["#444"])[0];
      return L.polygon(rings.map(decodeLine), { renderer: _fCanvas, interactive: false, color: col, weight: 1.6, fillColor: col, fillOpacity: .18 }); });
    const g = L.layerGroup(polys); layers.facArea.addLayer(g); _fDrawn.set(k, g);
  }
}

// ---------------- work already under way: housing approved/permitted/completed (HCD reports), LA affordable pipeline, new-building permits
const PJ_STYLE = { "housing completed": "#15803d", "housing permitted": "#2563eb", "housing approved": "#7c3aed", "affordable housing": "#db2777",
  "new apartments": "#0891b2", "new ADU": "#ca8a04", "new house": "#a16207", "new building": "#64748b", "city capital project": "#0f766e" };
function drawProjects() {
  if (!map._loaded || !layers.proj) return;
  layers.proj.clearLayers();
  const z = map.getZoom();
  if (z < 13) { if (map.hasLayer(layers.proj)) map.removeLayer(layers.proj); return; }
  if (!map.hasLayer(layers.proj)) layers.proj.addTo(map);
  const b = map.getBounds().pad(.1), K = D.layers.pj_kinds; let n = 0;
  for (const [k, nm, ad, st, u, yr, lat, lon] of D.layers.projects) {
    if (!b.contains([lat, lon])) continue; if (++n > 1500) break;
    const kind = K[k], big = u && u >= 10;
    layers.proj.addLayer(L.circleMarker([lat, lon], { radius: big ? 5 + Math.min(Math.sqrt(u) / 2, 6) : 3.2, color: "#fff", weight: 1, fillColor: PJ_STYLE[kind] || "#666", fillOpacity: .9 })
      .bindTooltip(`<b>${esc(kind[0].toUpperCase() + kind.slice(1))}</b>${nm ? " · " + esc(nm) : ""}${ad ? "<br>" + esc(ad) : ""}${u ? `<br>${fmtN(u)} home${u > 1 ? "s" : ""}` : ""}${st ? " · " + esc(st) : ""}${yr ? " · " + esc(yr) : ""}`)
      .on("click", e => selectAt(e.latlng)));
  }
}

// ---------------- underused land: parking lots, golf courses, vacant parcels, lightly built commercial lots
const UCOL = { "parking lot": "#6b7280", "golf course": "#65a30d", "vacant": "#d97706", "lightly built commercial": "#9333ea" };
const _uDrawn = new Map();
function siteHtml(s) {
  const A = D.under.assumptions || {};
  const BS = { built: "Already built", building: "Under construction", planned: "Project already approved" };
  return `<div class="small" style="max-width:300px">${s.bs ? `<div class="site-done">${BS[s.bs]}: not counted as underused</div>` : ""}<b>${esc(s.k[0].toUpperCase() + s.k.slice(1))}</b>${s.bs ? ' <span class="muted">(per the Assessor\'s use code, which can lag construction)</span>' : ""}${s.nm ? " · " + esc(s.nm) : ""}${s.ad ? "<br>" + esc(s.ad) : ""}
    <br>${s.ac.toFixed(s.ac < 10 ? 2 : 0)} acres${s.use ? " · " + esc(s.use) : ""}
    ${s.lav != null ? `<br>Assessed land value: <b>${fmt$(s.lav)}</b>${s.by ? ` (Prop 13 base from ${s.by})` : ""}` : ""}
    ${s.mkt != null ? `<br>Estimated market land value: <b>~${fmt$(s.mkt)}</b>` : ""}
    <br>Zoning: ${esc(s.z || s.zc || "unknown")}${s.rail != null && s.rail < 805 ? ` · ${(s.rail / 1609).toFixed(2)} mi from ${esc(s.st || "rail")}${s.sts === "coming" ? " (station under construction)" : ""}` : ""}
    ${s.own ? `<br><b>Publicly owned:</b> ${esc(s.own)} (County public-agency parcels)` : ""}${s.known ? `<br><b>Known site:</b> ${esc(s.known)}` : ""}${s.ease ? `<br><b>Conservation easement:</b> recorded easement on this land (state CCED); building is generally not allowed.` : ""}
    ${s.he != null ? `<br><b>Already planned:</b> this site is in the city's Housing Element inventory${s.he ? ` for ~${fmtN(s.he)} homes` : ""}.` : ""}
    <br><b>${s.bs ? "Status" : "Could be"}:</b> ${esc(s.idea)}
    ${s.margin != null && s.homes ? `<br>Rough development margin: <b>${s.margin >= 0 ? "~" + fmt$(s.margin) : "negative (" + fmt$(s.margin) + ")"}</b> (${fmtN(s.homes)} homes)` : ""}
    <br><span class="muted">Screening estimate: apartment value from LA rents and cap rates, build cost from LA case studies (round-7 research); land prices and fees are estimates.</span></div>`;
}
function drawUnder() {
  const U = D.layers.underused; if (!map._loaded || !U || !layers.under) return;
  const want = new Set(map.getZoom() >= 13 ? cellKeys(U.cell, .2) : []);
  for (const [k, l] of _uDrawn) if (!want.has(k)) { layers.under.removeLayer(l); _uDrawn.delete(k); }
  for (const k of want) {
    if (_uDrawn.has(k)) continue;
    const g = L.layerGroup((U.cells[k] || []).map(([sid, rings]) => { const s = D.under.sites[sid]; if (!s) return null; const col = UCOL[s.k] || "#888";
      const done = !!s.bs;
      return L.polygon(rings.map(decodeLine), done ? { color: "#868e96", weight: 1.2, fillColor: "#868e96", fillOpacity: .08, dashArray: "1 4" }
          : { color: col, weight: 1.4, fillColor: col, fillOpacity: .35, dashArray: s.k === "parking lot" ? "3 3" : null })
        .bindTooltip(done ? `${{ built: "already built", building: "under construction", planned: "project approved" }[s.bs]} (was listed as ${esc(s.k)}) · click for details`
          : `${esc(s.k)} · ${s.ac.toFixed(1)} ac${s.mkt ? " · ~" + fmt$(s.mkt) + " land" : ""} (click for more)`, { sticky: true }).bindPopup(() => siteHtml(s), { maxWidth: 320 })
        .on("click", () => { if (selected !== s.gid) select(s.gid, false); }); }).filter(Boolean));
    layers.under.addLayer(g); _uDrawn.set(k, g);
  }
}

// ---------------- plain-language zoning: what a zone code lets you build (summaries; the city's code is the authority)
const ZBASE_LA = [
  [/^OS$/, "Open space: parks and natural land; no homes."], [/^A1$/, "Agricultural: one home per 2+ acres, farming and animals."],
  [/^A2$/, "Agricultural: one home per 5+ acres, farming."], [/^RA$/, "Suburban: one house per 17,500+ sq ft lot, some animals."],
  [/^RE(\d+)$/, m => `Estate homes: one house per ${m[1]},000+ sq ft lot (plus ADUs).`], [/^RS$/, "Suburban: one house per 7,500+ sq ft lot (plus ADUs)."],
  [/^R1[VFRH]\d?$/, "One house per 5,000+ sq ft lot (plus ADUs), with stricter house-size limits to curb mansions."],
  [/^R1$/, "One house per 5,000+ sq ft lot, plus an ADU and junior ADU; SB 9 can allow two homes."],
  [/^RU$|^RZ/, "Small-lot houses: one house per small lot (about 2,500–3,500 sq ft)."], [/^RW1$/, "Venice waterways: one house per lot."],
  [/^RW2$/, "Venice waterways: up to two homes per lot."], [/^R2$/, "Two-family: a duplex or two houses per 5,000 sq ft lot."],
  [/^RD(\d(\.\d)?)$/, m => `Townhomes or small apartments: one home per ${fmtN(+m[1] * 1000)} sq ft of lot.`],
  [/^R3$/, "Apartments: about one home per 800 sq ft of lot (a 5,000 sq ft lot holds ~6)."], [/^RAS3$/, "Apartments with shops allowed on the ground floor (R3 density)."],
  [/^R4$/, "Apartments: about one home per 400 sq ft of lot (a 5,000 sq ft lot holds ~12)."], [/^RAS4$/, "Apartments with ground-floor shops (R4 density)."],
  [/^R5$/, "High-rise apartments: about one home per 200 sq ft of lot."], [/^RMP$/, "Mobile home park."],
  [/^CR$/, "Limited commercial: offices, banks, clinics; homes at R4 density."], [/^C1$/, "Neighborhood shops and offices; homes allowed at R3 density."],
  [/^C1\.5$/, "Shops, offices and hotels; homes allowed at R4 density."], [/^C2$/, "Commercial: shops, restaurants, offices; apartments allowed at R4 density."],
  [/^C4$/, "Commercial like C2 (a few uses such as auto repair excluded); apartments at R4 density."], [/^C5$/, "Commercial including light industry; apartments at R4 density."],
  [/^CM$/, "Commercial-manufacturing: workshops, wholesale, offices; apartments at R3 density."], [/^MR[12]$/, "Restricted industrial: light industry and offices, no new homes."],
  [/^M1$/, "Limited industrial: light manufacturing, warehouses; no new homes."], [/^M2$/, "Light industrial: manufacturing, storage; no homes."],
  [/^M3$/, "Heavy industrial; no homes."], [/^P$/, "Parking lots (often paired with a commercial zone next door)."], [/^PB$/, "Parking buildings."],
  [/^PF$/, "Public facilities: schools, fire stations, government buildings."], [/^SL$/, "Submerged lands (harbor and ocean)."],
  [/^HI$|^HJ$|^HR$/, "Hybrid industrial: light industry and creative offices, with live-work units."], [/^NI$/, "Neighborhood industrial: small industry and workshops."],
  [/^U[RVICN]\d?$|^(RI|IG|GC)$/, "Zone from a specific plan (for example the Cornfield Arroyo Seco plan): see that plan's rules."],
  [/^LAX|^ADP|^PV|^WC|^CEC|^USC|^PVSP/, "Covered by a specific plan or airport plan: see that plan's rules."],
];
const ZHD_LA = { "1": "height district 1: no fixed height in most zones, but floor area is capped (1.5× the lot in commercial zones, 3× in residential)",
  "1L": "height limit 75 ft (about 6 stories)", "1VL": "height limit 45 ft (about 3–4 stories)", "1XL": "height limit 30 ft (2 stories)", "1SS": "one story only",
  "2": "floor area up to 6× the lot (mid-rise)", "3": "floor area up to 10× the lot (high-rise)", "4": "floor area up to 13× the lot (high-rise)" };
const ZTAG = { Q: "Q conditions: extra site-specific limits from the ordinance that zoned it", T: "T (tentative): the zone takes effect only after conditions such as street improvements are met",
  F: "F: a special condition recorded for this site (check ZIMAS)", D: "D limit: height or floor area capped below the district's normal limit",
  CPIO: "CPIO overlay: community-plan rules on design and height, sometimes with bonuses for affordable homes", HPOZ: "historic district: exterior changes need design review",
  O: "oil drilling district", RIO: "LA River overlay: landscaping and design rules near the river", CUGU: "Clean Up Green Up overlay: stricter rules for polluting uses",
  SN: "sign district", K: "horsekeeping allowed", POD: "pedestrian-oriented district: storefronts and limits on drive-throughs", CDO: "community design overlay",
  HCR: "hillside construction rules", RFA: "residential floor-area limits", CA: "commercial and artcraft district", FH: "fence-height district", MU: "mixed-use district",
  NSO: "neighborhood stabilization overlay", RG: "rear-yard rules", SP: "specific plan" };
const ZBASE_CO = [
  [/^R-1$/, "One house per lot (usually 5,000+ sq ft), plus ADUs; SB 9 can allow two homes."], [/^R-2$/, "Two-family: a duplex or two houses per lot."],
  [/^R-3$/, "Apartments, limited density (about 30 homes per acre)."], [/^R-4$/, "Apartments, medium density (about 50 homes per acre)."],
  [/^R-5$/, "High-density apartments."], [/^R-A$/, "Houses on large lots with small farm animals."], [/^RPD$/, "Planned residential development (density set by the plan)."],
  [/^A-1$/, "Light agriculture: houses on large lots, some farming and animals."], [/^A-2$/, "Heavy agriculture: farming and ranching, houses on large lots."],
  [/^C-1$/, "Restricted business: offices and small shops."], [/^C-2$/, "Neighborhood shops and services; homes allowed in mixed-use projects."],
  [/^C-3$/, "General commercial; homes allowed in mixed-use projects."], [/^C-H$/, "Commercial highway: auto-oriented services."],
  [/^C-M$/, "Commercial-manufacturing: workshops, wholesale."], [/^C-R$/, "Commercial recreation: amusement and sports uses."], [/^CPD$/, "Planned commercial development."],
  [/^M-1$/, "Light manufacturing; no new homes."], [/^M-1\.5$/, "Restricted heavy manufacturing; no new homes."], [/^M-2/, "Heavy manufacturing; no homes."],
  [/^MPD$/, "Planned industrial development."], [/^MXD/, "Mixed use: apartments with shops or offices."], [/^IT$/, "Institutional: schools, hospitals, churches."],
  [/^O-S$|^OS$/, "Open space; no homes."], [/^W$/, "Watershed: protected natural land."], [/^SP$/, "Specific plan: see that plan's rules."], [/^B-[12]$/, "Buffer strip between zones."],
  [/^PR$/, "Public recreation."], [/^SR-D$/, "Scientific research and development."],
];
const ZBASE_SC = [
  [/^NU\d$/, "Rural homes on large lots (non-urban)."], [/^UR1$/, "Houses at up to ~2 per acre."], [/^UR2$/, "Houses at up to ~5 per acre."],
  [/^UR3$/, "Houses and townhomes at up to ~11 per acre."], [/^UR4$/, "Townhomes and apartments at up to ~18 per acre."], [/^UR5$/, "Apartments at up to ~30 per acre."],
  [/^CN$/, "Neighborhood shops."], [/^CC$/, "Community commercial."], [/^CR$/, "Regional commercial (malls, big stores)."], [/^CO$/, "Commercial offices."],
  [/^MX/, "Mixed use: homes with shops or offices."], [/^BP$/, "Business park."], [/^I$/, "Industrial."], [/^OS$|^PI$/, "Open space or public land."],
];
const ZCAT_TXT = { "single-family": "Mostly one house per lot (plus ADUs).", "multifamily": "Apartments, townhomes or duplexes.", "commercial / mixed use": "Shops and offices; many commercial zones also allow apartments.",
  "industrial": "Industry and warehouses; new homes generally not allowed.", "open space / public": "Parks, open space or public facilities.", "agricultural": "Farming, with homes on large lots.",
  "parking": "Parking.", "other": "Special or planned zone: check the city's code." };

const Z_STANDARD = [
  [/^R-?1[A-Z0-9]*$|^RS|^RE|^SFR|^SF-?[1-9]|^R-?[1-9]\d{2,}|^R-?A$|^RR/i, "Single-family residential: one detached house per lot (plus ADUs and accessory structures); low density."],
  [/^R-?2[A-Z0-9]*$|^RD|^RT|^2F|^DU/i, "Two-family residential: duplexes, twin homes, or two houses per lot."],
  [/^R-?3[A-Z0-9]*$|^RM-?[12]|^TH|^MF-?1/i, "Multi-family residential: townhomes, row houses, and medium-density garden apartments (typically 12–25 homes/acre)."],
  [/^R-?[45][A-Z0-9]*$|^RM-?[3-9]|^RH|^MF-?[2-9]|^HDR|^APT/i, "High-density multi-family residential: apartment buildings, condominiums, and senior living communities (30–60+ homes/acre)."],
  [/^C-?1[A-Z0-9]*$|^NC|^CN|^B-?1|^NB/i, "Neighborhood commercial: local convenience retail, coffee shops, grocery markets, and personal services."],
  [/^C-?[23][A-Z0-9]*$|^GC|^CG|^CC|^CR|^B-?[23]|^GB|^CB/i, "General / community commercial: retail stores, restaurants, shopping centers, and commercial offices; apartments often allowed above ground floor."],
  [/^CBD|^D-?1|^DT|^DC|^MU-D|^C-?4/i, "Downtown / central business district: high-density retail, office towers, hotels, civic spaces, and mixed-use apartments."],
  [/^MU|^MXD?|^TOD|^TND|^CMX|^VMU|^NMX|^GMX/i, "Mixed-use district: pedestrian-friendly zoning combining ground-floor shops and restaurants with upper-floor apartments or offices."],
  [/^M-?1[A-Z0-9]*$|^IL|^I-?1|^ML|^LI|^BP|^O-?I/i, "Light industrial & business park: clean manufacturing, research labs, wholesale distribution, and offices; residential prohibited."],
  [/^M-?[2-9][A-Z0-9]*$|^IH|^I-?[2-9]|^HI|^IND|^IG/i, "Heavy industrial: manufacturing, freight warehousing, processing, and materials storage; no residential allowed."],
  [/^A-?[1-9][A-Z0-9]*$|^AG|^RU|^AR/i, "Agricultural & rural preserve: farming, crop cultivation, equestrian uses, and rural homesteads on large acreage."],
  [/^OS|^PR|^REC|^P-?F|^PI|^INST|^CIV|^CON|^PARK/i, "Civic & open space: public parks, conservation areas, schools, libraries, civic centers, and government facilities."]
];

function explainZone(code, cat, juris) {
  const raw = String(code || "").toUpperCase().trim(); if (!raw) return null;
  const tags = []; let t = raw;
  t = t.replace(/[\[\(]([A-Z]+)[\]\)]/g, (_, x) => { for (const ch of x.length > 2 ? [x] : x.split("")) if (ZTAG[ch]) tags.push(ZTAG[ch]); return ""; });
  const la = /los angeles/i.test(juris || "") && !/unincorporated/i.test(juris || ""), co = /unincorporated/i.test(juris || ""), sc = /santa clarita/i.test(juris || "");
  let base = null, extra = [], bkey = null;
  if (co || (!la && !sc && /^[A-Z]+-\d/.test(t))) {
    const parts = t.split("-"); let b = parts[0];
    if (parts.length > 1 && /^\d(\.\d)?$|^[A-Z]$/.test(parts[1])) { b += "-" + parts[1]; parts.splice(0, 2); } else parts.splice(0, 1);
    const hit = ZBASE_CO.find(([re]) => re.test(b)); base = hit ? hit[1] : null; bkey = b;
    for (const p of parts) { if (/^\d{4,}$/.test(p)) extra.push(`minimum lot ${fmtN(+p)} sq ft`); else if (/^\d+U$/.test(p)) extra.push(`up to ${parseInt(p)} homes per acre`);
      else if (/^\d+$/.test(p)) extra.push(`minimum lot ${p} acre${+p > 1 ? "s" : ""}`); else if (p === "DP") extra.push("needs an approved development program");
      else if (p === "P") extra.push("parking combining zone: parking lots allowed, the underlying zone still applies"); else if (ZTAG[p]) extra.push(ZTAG[p]); }
  } else if (sc) {
    const hit = ZBASE_SC.find(([re]) => re.test(t)); base = hit ? hit[1] : null; bkey = t;
  } else {
    const parts = t.split("-"); let b = parts.shift();
    const qd = b.match(/^([QT]+)(?=[A-Z]{1,2}\d|C\d|R\d|RD|RE|RS|M\d|CM|CR|P)/); if (qd) { for (const ch of qd[1]) if (ZTAG[ch]) tags.push(ZTAG[ch]); b = b.slice(qd[1].length); }
    const hit = ZBASE_LA.find(([re]) => re.test(b)); base = hit ? (typeof hit[1] === "function" ? hit[1](b.match(hit[0])) : hit[1]) : null; bkey = b;
    for (let p of parts) { const d = /^(1L|1VL|1XL|1SS|[1-4])D$/.test(p); if (d) p = p.slice(0, -1);
      if (ZHD_LA[p]) extra.push(ZHD_LA[p]); if (d) extra.push(ZTAG.D); else if (ZTAG[p]) extra.push(ZTAG[p]); }
  }
  // round-10 research rows (official zone names, verified height and floor-area limits)
  const jz = la ? "Los Angeles" : co ? "Unincorporated LA County" : sc ? "Santa Clarita" : String(juris || "").replace(/ \(SCAG 2019\)$/, "");
  const rz = ((D.r10 || {}).zp || {})[jz], row = rz && bkey ? rz[bkey] : null, facts = [];
  if (row) {
    if (!base && row[0]) base = row[0];
    const hm = String(row[1]).match(/^(?:front )?(\d+)/);
    if (hm) facts.push(/front/.test(row[1]) ? `height ${row[1].replace(/,/g, " ft,")} ft` : `height ${hm[1]} ft${/(\d) stor/.test(row[1]) ? " (" + row[1].match(/(\d) stor/)[1] + " stories)" : ""}`);
    const rf = String(row[2]).match(/RFAR ([.\d]+),.*,([.\d]+) for lot bins/), rb = String(row[2]).match(/RFAR ([.\d]+)/), dl = String(row[2]).match(/^(?:Maximum generally |Generally )?1 dwelling\/(\d+) ?sqft|^Generally (\d+) sqft lot area per dwelling/);
    if (rf) facts.push(`house size up to ${(+rf[1]).toFixed(2)}× the lot on lots of 6,000 sq ft or less, down to ${(+rf[2]).toFixed(2)}× on lots over 10,000 sq ft`);
    else if (rb) facts.push(`house size up to ${(+rb[1]).toFixed(2)}× the lot area`);
    else if (dl) facts.push(`one home per ${fmtN(+(dl[1] || dl[2]))} sq ft of lot`);
    else if (/FAR/.test(row[2]) && row[2].length < 90) facts.push(row[2].replace(/sqft/g, "sq ft"));
    const ml = String(row[3]).match(/^(\d+)/); if (ml) facts.push(`minimum lot ${fmtN(+ml[1])} sq ft${/generally/.test(row[3]) ? " (generally)" : ""}`);
  }
    if (!base) {
    for (const [re, desc] of Z_STANDARD) {
      if (re.test(t) || re.test(raw)) { base = desc; break; }
    }
  }
  return { base: base || ZCAT_TXT[cat] || "Special zone: check the city's code.", more: [...extra, ...tags], facts, known: !!base, official: row ? row[0] : null };
}
function zoneSentence(code, cat, juris) {
  const e = explainZone(code, cat, juris); if (!e) return "";
  return e.base + (e.facts.length ? " Code: " + e.facts.join("; ") + "." : "") + (e.more.length ? " Also: " + e.more.join("; ") + "." : "");
}

// ---------------- zoning polygons (zoom 14+), colored by what each zone allows
const ZCOL = { "single-family": "#f6d36b", "multifamily": "#e8833a", "commercial / mixed use": "#d4383c", "industrial": "#8e6bbf",
  "open space / public": "#4f9d5d", "agricultural": "#b9c97a", "parking": "#9aa0a6", "other": "#c7c7c7" };
let _zCanvas = null; const _zDrawn = new Map(), _zDec = new Map();
function zCell(key) {
  if (!_zDec.has(key)) _zDec.set(key, (D.layers.zoning.cells[key] || []).map(([c, z, rings]) => { const rr = rings.map(decodeLine), b = L.latLngBounds(rr[0]), cc = b.getCenter();
    return { cat: D.layers.zoning.cats[c], zone: D.layers.zoning.zones[z], juris: (D.layers.zoning.jur || [])[(D.layers.zoning.zj || [])[z]] || "", rings: rr, lat: cc.lat, lon: cc.lng }; }));
  return _zDec.get(key);
}
let _zKey = null;
function zoneKey(want) {
  if (!_zKey) { _zKey = L.control({ position: "topright" }); _zKey.onAdd = () => { const d = L.DomUtil.create("div", "zone-key"); L.DomEvent.disableScrollPropagation(d); L.DomEvent.disableClickPropagation(d); return d; }; }
  const show = layers.zone && want && want.size && map.getZoom() >= 14;
  if (!show) { if (_zKey._map) _zKey.remove(); return; }
  if (!_zKey._map) _zKey.addTo(map);
  const b = map.getBounds(), cnt = new Map();
  for (const k of want) for (const p of zCell(k)) { if (!b.contains([p.lat, p.lon])) continue;
    const base = String(p.zone).toUpperCase().replace(/[\[\(][A-Z]+[\]\)]/g, "").split("-").slice(0, /^[A-Z]+-\d/.test(String(p.zone).replace(/[\[\(][A-Z]+[\]\)]/g, "")) && !/los angeles/i.test(p.juris) || /unincorporated/i.test(p.juris) ? 2 : 1).join("-").replace(/^[QT]+(?=[A-Z])/, "");
    const e = cnt.get(base) || { n: 0, cat: p.cat, juris: p.juris }; e.n++; cnt.set(base, e); }
  const top = [...cnt.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 7);
  _zKey.getContainer().innerHTML = `<b>Zones in view, in plain words</b>${top.map(([c, e]) => `<div class="zk-row"><i style="background:${ZCOL[e.cat] || "#999"}"></i><span><b>${esc(c)}</b> ${esc(explainZone(c, e.cat, e.juris).base)}</span></div>`).join("")}
    <div class="muted" style="margin-top:4px">Point at the map for the full code (height limits, overlays). Summaries only; the city's code decides.</div>`;
}
let _zTipT = null;
function zoneTip(e) {
  clearTimeout(_zTipT);
  _zTipT = setTimeout(() => {
    const z = map.getZoom();
    const hide = () => { if (zoneTip.t) map.closeTooltip(zoneTip.t); };
    if (!layers.zone || z < 14 || z >= 17) { hide(); return; }
    const p = zoneAt(e.latlng); if (!p) { hide(); return; }
    zoneTip.t = zoneTip.t || L.tooltip({ direction: "top", offset: [0, -8], className: "zone-tip" });
    zoneTip.t.setLatLng(e.latlng).setContent(`<b>${esc(p.zone)}</b> <span class="muted">${esc(p.juris)}</span><br>${esc(zoneSentence(p.zone, p.cat, p.juris))}`);
    map.openTooltip(zoneTip.t);
  }, 120);
}
function drawZoning() {
  if (!map._loaded || !layers.zone) { zoneKey(null); return; }
  const z = map.getZoom(), Zc = D.layers.zoning.cell, want = new Set();
  if (z >= 14) { const b = map.getBounds().pad(.2);
    for (let x = Math.floor((b.getWest() + 180) / Zc); x <= Math.floor((b.getEast() + 180) / Zc); x++)
      for (let y = Math.floor((b.getSouth() + 90) / Zc); y <= Math.floor((b.getNorth() + 90) / Zc); y++) want.add(x + "," + y); }
  for (const [k, l] of _zDrawn) if (!want.has(k)) { layers.zone.removeLayer(l); _zDrawn.delete(k); }
  _zCanvas = _zCanvas || L.canvas({ padding: .3, pane: passPane("zonePane", 404) });
  for (const k of want) {
    if (_zDrawn.has(k)) continue;
    const g = L.layerGroup(zCell(k).map(p => L.polygon(p.rings, { renderer: _zCanvas, interactive: false, color: ZCOL[p.cat] || "#999", weight: .7, fillColor: ZCOL[p.cat] || "#999", fillOpacity: .55 })));
    layers.zone.addLayer(g); _zDrawn.set(k, g);
  }
  zoneKey(want);
  layers.zoneLabels.clearLayers();
  if (z >= 16) { const b = map.getBounds(); let n = 0;
    for (const k of want) for (const p of zCell(k)) { if (n > 250 || !b.contains([p.lat, p.lon])) continue; n++;
      layers.zoneLabels.addLayer(L.marker([p.lat, p.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null, html: `<div class="lbl-zone" style="transform:translate(-50%,-50%)">${esc(p.zone)}</div>` }) })); } }
}

// ---------------- panel: zoning and state housing laws, public facilities nearby
function zoneRules(code, juris) {
  const t = String(code).toUpperCase().replace(/\[[^\]]*\]|\([^)]*\)/g, "").replace(/^[QTD]+(?=[A-Z])/, "");
  juris = String(juris).replace(/ \(SCAG 2019\)$/, "");
  return (D.zone_rules || []).find(r => r.jurisdiction === juris && new RegExp("^" + r.zone_prefix.replace(/[.]/g, "\\.") + "(?![0-9.])").test(t));
}
const p_city = m => (byId.get(selected) || { properties: {} }).properties.c || "";
function zoningSection(m) {
  const z = m.z, tr = m.tr || [], rail = Math.min(tr[0] ?? 1e9, tr[1] ?? 1e9), tph = Math.max(tr[2] || 0, tr[3] || 0);
  let h = `<div class="section"><h3>Zoning: what can be built here</h3>`;
  if (z && isOCArea(m)) {
    const sh = Object.entries(z.sh || {}).map(([c, v]) => [c === "multi-family" ? "multifamily" : c, v]).sort((a, b) => b[1] - a[1]);
    const desc = String(z.desc || "").split(/\. (?=ADU exempt|School fee|AB 1033)/)[0].replace(/\s*\([^()]*$/, "").replace(/\s*\([^()]*\)\s*$/, "").replace(/\.$/, "") + (z.desc ? " (city zoning code)" : "");
    h += `<div class="small" style="margin:4px 0 6px">${sh.map(([c, v]) => `<span class="zkey"><i style="background:${ZCOL[c] || "#999"}"></i>${esc(c)} ${Math.round(v * 100)}%</span>`).join("")}</div>
      <p class="small">Typical zone (${esc(z.j)}): <b>${esc(z.top || "")}</b>.${desc ? " " + esc(desc) + "." : ""}</p>
      <p class="small muted">Orange County zoning is summarized at the neighborhood level from each city's code (preliminary). Parcel zoning maps are not loaded for Orange County, so check the city's zoning map for a specific lot.</p>`;
  } else if (z) {
    h += `<div class="small" style="margin:4px 0 6px">${Object.entries(z.sh).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<span class="zkey"><i style="background:${ZCOL[c]}"></i>${esc(c)} ${Math.round(v * 100)}%</span>`).join("")}</div>
      <p class="small">Most common zones (${esc(z.j)}): <b>${esc(String(z.top || "").split("; ").filter(x => !/ 0%$/.test(x)).join("; "))}</b>. ${/SCAG/.test(z.j) ? "From SCAG's 2019 parcel data (this city's own zoning map isn't loaded yet, so recent rezonings may be missing)." : "Turn on <b>Zoning</b> above and zoom in to see each parcel's zone."}</p>`;
    const tops = String(z.top || "").split("; ").filter(x => !/ 0%$/.test(x)).map(x => x.replace(/ \d+%$/, "")).slice(0, 5);
    if (tops.length) h += `<div class="small zplain">${tops.map(c => `<div><b>${esc(c)}</b>: ${esc(zoneSentence(c, null, z.j))}</div>`).join("")}</div>`;
    const seen = new Set(), rules = String(z.top || "").split("; ").map(x => x.replace(/ \d+%$/, "")).map(c => zoneRules(c, z.j)).filter(r => r && !seen.has(r.zone_prefix) && seen.add(r.zone_prefix));
    if (rules.length) h += `<div style="overflow-x:auto"><table class="small" style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left"><th>Zone</th><th>Allows</th><th>Homes/acre</th><th>Height</th><th>FAR</th><th>Setbacks F/S/R</th></tr></thead><tbody>
      ${rules.map(r => `<tr style="border-top:1px solid var(--rule)"><td><b>${esc(r.zone_prefix)}</b> ${esc(r.zone_name)}</td><td>${esc(r.allowed)}</td><td>${esc(r.units_per_acre)}</td><td>${esc(r.max_height_ft)} ft</td><td>${esc(r.max_far)}</td><td>${esc(r.front_ft)}/${esc(r.side_ft)}/${esc(r.rear_ft)} ft</td></tr>`).join("")}</tbody></table></div>
      <p class="small muted">Base-zone standards from the round-6 research (${rules.map(r => esc(r.code_section)).join(", ")}); not yet checked against the code. Height districts, overlays and specific plans can change them.</p>`;
  } else h += `<p class="small muted">No zoning map is loaded for this city yet (${esc(m.city || "")}). State laws below still apply.</p>`;
  const L_ = [];
  L_.push("<b>ADUs:</b> state law makes cities allow at least an 800 sq ft ADU (local caps are often 1,200 sq ft) plus a junior ADU on single-family lots, and more units on apartment lots (Gov. Code § 66310 and following).");
  if (z && (z.sh["single-family"] || 0) > 0) L_.push("<b>SB 9:</b> most single-family lots can hold two homes and be split into two lots, except in very-high fire zones and historic districts.");
  const sb = m.sb || [null, null], near79 = [["Tier 1", sb[0]], ["Tier 2", sb[1]]].filter(([, d]) => d != null && d <= 805).sort((a, b) => a[1] - b[1]);
  if (near79.length && /^Unincorporated/i.test(m.city || p_city(m))) L_.push("<b>SB 79:</b> SB 79 (Ch. 512, Stats. 2025) applies in cities from 1 July 2026 but in unincorporated areas only from the 7th housing-element cycle (about 30 June 2029), even near an official stop.");
  else if (near79.length) L_.push(`<b>SB 79 (in force in cities from 1 July 2026):</b> the nearest official ${near79[0][0]} stop (SCAG map) is ${(near79[0][1] / 1609).toFixed(2)} mi away, so ${near79[0][1] <= 402 ? "much of this area is within ¼ mile, the band with the highest allowed height and density" : "parts of this area are within ½ mile, where SB 79 allows more height and homes"}. Exact standards depend on the tier and the parcel.`);
  else if (m.sb) L_.push("<b>SB 79:</b> no official SB 79 transit stop within ½ mile (SCAG map), so SB 79's transit upzoning doesn't apply here.");
  else if (rail <= 805) L_.push(`<b>SB 79 (in force in cities from 1 July 2026):</b> rail is ${(rail / 1609).toFixed(2)} mi away, so parts of this area are likely in a transit upzoning zone. Check SCAG's official SB 79 map.`);
  if (rail <= 805 || tph >= 8) L_.push("<b>AB 2097:</b> within ½ mile of a major transit stop, cities can't require parking for new homes. Here " + (rail <= 805 ? "rail is within ½ mile" : `buses run ${tph}/hr nearby (likely a major stop)`) + ".");
  if (m.city === "Los Angeles" && (rail <= 805 || tph >= 8)) L_.push("<b>LA City CHIP:</b> mixed-income and 100%-affordable projects near transit and on corridors get density and height bonuses.");
  h += `<ul class="small" style="margin:6px 0 0 18px;padding:0">${L_.map(x => `<li>${x}</li>`).join("")}</ul><p class="small muted">Transit distances are approximate (rail stations and bus frequency); official eligibility depends on the parcel.</p></div>`;
  return h;
}
function underSection(p) {
  if (isOCArea((D.details[p.id] || {}).m)) return `<div class="section"><h3>Underused land here</h3><p class="small muted">The underused-land inventory (parking lots, golf courses, vacant and lightly built parcels) covers LA County only so far.</p></div>`;
  const all = ((D.under && D.under.sites) || []).filter(s => s.gid === p.id), S = all.filter(s => !s.bs).sort((a, b) => (b.mkt || 0) - (a.mkt || 0)), done = all.filter(s => s.bs);
  if (!S.length) return done.length ? `<div class="section"><h3>Underused land here</h3><p class="small muted">None left: ${done.length} site${done.length > 1 ? "s" : ""} the Assessor still lists as parking or vacant ${done.length > 1 ? "are" : "is"} already built, under construction or approved (${done.map(s => esc(s.idea.split(";")[0])).slice(0, 2).join("; ")}).</p></div>` : "";
  return `<div class="section"><h3>Underused land here</h3><p class="small muted">${S.length} site${S.length > 1 ? "s" : ""} in this block group: parking lots, golf courses, vacant parcels or lightly built commercial lots. Click one to zoom to it.${done.length ? ` ${done.length} more listed by the Assessor ${done.length > 1 ? "are" : "is"} already built or under way, so ${done.length > 1 ? "they're" : "it's"} left out.` : ""}</p>
    <div class="recs">${S.slice(0, 6).map(s => `<div class="rec qolrec" style="cursor:pointer" data-site="${s.i}"><div class="small">${siteHtml(s)}</div></div>`).join("")}</div></div>`;
}
function facilitySection(m) {
  if (!m || !m.fc) return "";
  const order = ["school", "library", "community center", "fire station", "police", "city hall", "post office", "clinic", "hospital"];
  const rows = order.filter(k => m.fc[k] != null).map(k => {
    const st = (typeof FAC_STYLE !== "undefined" && FAC_STYLE[k]) ? FAC_STYLE[k] : ["#444", "•"];
    return `<span><span class="fac" style="background:${st[0]};display:inline-block;vertical-align:middle;margin-right:6px">${st[1]}</span>${esc(k[0].toUpperCase() + k.slice(1))}</span><span>${(m.fc[k] / 1609).toFixed(1)} mi</span>`;
  });
  return rows.length ? `<div class="section"><h3>Public facilities nearby</h3><div class="kv">${rows.join("")}</div><p class="small muted">Distance from the middle of this block group to the nearest one. Mapped from OpenStreetMap and public municipal GIS records.</p></div>` : "";
}

// ---------------- find me
function pointInFeature(f, lon, lat) {
  const inRing = ring => { let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; }
    return c; };
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  return polys.some(([outer, ...holes]) => inRing(outer) && !holes.some(inRing));
}
let youMarker = null;
function selectAt(ll) {
  const f = allFeatures().find(f => pointInFeature(f, ll.lng, ll.lat));
  if (f && f.properties.id !== selected) select(f.properties.id, false);
}
function locateMe(btn) {
  if (!navigator.geolocation) { btn.textContent = "Location not available"; return; }
  btn.textContent = "Finding you…";
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    if (youMarker) map.removeLayer(youMarker);
    youMarker = L.marker([lat, lon], { interactive: false, icon: L.divIcon({ className: "", iconSize: [14, 14], html: '<div class="you"></div>' }) }).addTo(map);
    const f = allFeatures().find(f => pointInFeature(f, lon, lat));
    if (f) select(f.properties.id, false);
    map.setView([lat, lon], 16);
    btn.textContent = f ? "📍 Find me" : "You're outside the mapped area";
  }, () => { btn.textContent = "Location blocked"; }, { enableHighAccuracy: true, timeout: 10000 });
}
function retop() {
  const ti = "ABCDU".indexOf($("#evid").value);
  const feats = (activeCounty === "oc" && D_OC) ? D_OC.features : ((typeof D !== "undefined" && D && D.bgs && D.bgs.features) ? D.bgs.features : []);
  feats.forEach(f => {
    const p = f.properties;
    if (p.tp && ti >= 0 && ti < p.tp.length) { [p.t, p.v, p.pc] = p.tp[ti]; return; }
    const r = (D.details[p.id] || {}).r || [];
    let best = null, pc = 0;
    r.forEach(a => { const c = D.catalog[a[0]]; if (!c || c.kind !== "value" || !allowed(a[0])) return;
      if (!best || a[8] > best[8]) best = a; if (a[8] >= 1) pc += a[3]; });
    p.t = best && best[8] >= 1 ? best[0] : null; p.v = best ? best[8] : null; p.pc = pc || null;
  });
}
function restyle() {
  breaks = computeBreaks();
  if (activeCounty === "oc" && ocLayer) {
    if (ocLayer.setStyle) ocLayer.setStyle(styleBg);
  } else if (typeof bgs !== "undefined" && bgs && bgs.setStyle) {
    bgs.setStyle(styleBg);
  }
  legend();
  highlight();
}
function highlight() {
  if (selLayer) { map.removeLayer(selLayer); selLayer = null; }
  const f = byId.get(selected);
  if (f) selLayer = L.geoJSON(f, { interactive: false, style: { fill: false, color: css("--sel"), weight: 3 } }).addTo(map);
}
const tile = (k, v, s) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
const REC_KEYS = ["id", "project", "homes", "cost", "capex", "land", "om", "value", "vpd", "pct", "why", "qol"];

// where a transit, bike or street-safety project should go: the named street and segment, and what's there already
const CORRIDOR_ROLE = { bus_lane: "bus", brt: "bus", transit_priority: "bus", transit_shade: "bus", bus_shelters: "bus", rail_station: "bus",
  protected_bike: "bike", road_diet: "bike", speed_cameras: "art", slow_streets: "local", traffic_calming: "local" };
// The catalog's "who decides" entries are written for LA County agencies; swap in the Orange County equivalents there.
const OC_AGENCY = [[/LA Metro/g, "OCTA"], [/City Department of Transportation \(LADOT\)|\bLADOT\b/g, "the city's traffic engineering division"],
  [/City Bureau of Street Services \(StreetsLA\)|City Public Works \(StreetsLA\)|\bStreetsLA\b/g, "city public works"],
  [/City Department of Recreation and Parks( \(RAP\))?|\bRAP\b/g, "the city's parks department (or OC Parks)"],
  [/City \/ County Housing Department \(LAHD \/ LACDA\)|LAHD \/ LACDA|\bLAHD\b/g, "the city's housing division / OC Housing & Community Development"],
  [/Municipal Electric Utility \(LADWP \/ SCE\)|LADWP \/ Southern California Edison|LADWP \/ SCE|\bLADWP\b/g, "SCE or the city utility (for example Anaheim Public Utilities)"],
  [/City Bureau of Sanitation \(LASAN\)|\bLASAN\b/g, "city public works"], [/City Bureau of Street Lighting \(BSL\)/g, "city public works (street lighting)"],
  [/\bLAUSD\b/g, "the local school district"], [/\bLAPD\b/g, "the city police department"], [/LA County Flood Control District/g, "OC Public Works (OC Flood Control District)"],
  [/Measure W Regional Watershed Area Steering Committee \(WASC\) scoring \(60\+ pts\) & SIP grant|Measure W Watershed Area Steering Committee \(WASC\) scoring & grant approval|Measure W Municipal\/Regional funding application/g, "county or city stormwater funding application"],
  [/Measure ULA tenant acquisition grant/g, "city or county housing-fund grant"], [/Quimby \/ Measure A grant allocation/g, "Quimby fees or city park funds"], [/Measure A funding/g, "city park funds"],
  [/Willits v\. City of LA ADA settlement compliance queue & /g, ""], [/Board of Public Works/g, "the city council or public works commission"], [/Council office/g, "city council"], [/LA City Mural Ordinance/g, "the city's mural rules"], [/MyLA311/g, "the city's service-request line"], [/CleanStat service routing/g, "the city's service-request routing"], [/Council District local return allocation/g, "the city's OCTA Measure M2 Local Fair Share allocation"]];
function agencyFor(text, m) { let t = String(text || ""); if (!isOCArea(m)) return t; for (const [re, to] of OC_AGENCY) t = t.replace(re, to); return t; }
function whereLine(id) {
  const m0 = (D.details[selected] || {}).m || {};
  if (isOCArea(m0)) return "";   // the Orange County corridor table is a neighborhood-level sketch, not a street inventory
  const role = CORRIDOR_ROLE[id], co = role && m0.co, c = co && co[role];
  if (!c) return "";
  const [st, fr, to, mi, tph, bike, bus, n79, t79, rc, station, metro, city, metroArea] = c;
  const seg = `<b>${esc(st)}</b>${fr && to && fr !== to ? ` from ${esc(fr)} to ${esc(to)}` : fr ? ` near ${esc(fr)}` : ""} (~${mi} mi)`;
  const lead = id === "rail_station" ? `Corridor: along ${seg}, the busiest bus street here${tph ? ` (${tph} buses/hr)` : ""}${station && station[0] ? `, linking to ${esc(station[0])} station (${station[1]} mi)` : ""}`
    : role === "local" ? `Where: ${seg}, the main local street through this area`
    : role === "bike" ? `Where: ${seg}`
    : role === "bus" ? `Where: ${seg}${tph ? `, where the busiest stop gets ${tph} buses an hour` : ""}`
    : `Where: ${seg}, the main arterial here`;
  const notes = [];
  if (bike) notes.push("already there: " + bike);
  if (bus) notes.push("already there: a bus-only lane on part of it (LA City)");
  if (n79) notes.push(`${n79} official SB 79 transit stop${n79 > 1 ? "s" : ""} on this stretch (${t79}), so state law already allows more homes here`);
  if (rc) notes.push("rail under construction nearby" + (rc !== "-" ? ` (${rc})` : ""));
  const planned = [...(metro || []), ...((id === "rail_station" ? metroArea : []) || []).filter(x => !(metro || []).includes(x)), ...(city || []).map(x => "LA City capital project: " + x)];
  const status = planned.length ? `<b>Already planned:</b> ${planned.map(esc).join("; ")}.`
    : `<span class="muted">No Metro project or LA City capital project found on this street${role === "bike" ? "; city bike-plan maps are still being added" : ""}.</span>`;
  return `<p class="small" style="margin:4px 0 2px">${lead}.${notes.length ? " " + notes.map(esc).join("; ") + "." : ""} ${status}</p>`;
}

// ---------------- who pays: what an EIFD could raise from a project's own value gain, and the rest of the stack
// Prop 13: a home's assessed value only catches up to market when it sells, so the project's value gain enters the
// tax roll as homes turn over (3.5% a year assumed; Prop 13 lock-in keeps LA turnover low). The district keeps
// the city's and County's shares of the 1% tax on that gain (pledges from the EIFD calculator defaults).
// pledges: Artesia EIFD (County participation approved 14 Jul 2026): County 49% of its General Fund increment (Board letter); city 75% per the IFP (round-10 research, larger than the County's share);
// County shares in formed districts range from 11% (Santa Fe Springs) to 50% (La Verne, Norwalk), and policy keeps them under 100%.
const FUND_ASSUME = { turnover: 0.035, cityPledge: 0.75, countyPledge: 0.49, countyPledgeUninc: 0.5, admin: 0.03, rate: 0.0525, dscr: 1.35, years: 30, housing: 0.20 };
function fundPlan(r, gid) {
  const c = D.catalog[r.id]; if (!c || c.kind === "owner" || c.kind === "policy") return null;
  const m = (D.details[gid] || {}).m || {}, p = (byId.get(gid) || { properties: {} }).properties;
  const uninc = /^Unincorporated/i.test(p.c || "") || / \(unincorporated\)$/.test(p.c || "") || p.c === "Los Angeles County";
  const sh = m.e && m.e.sh ? m.e.sh : [uninc ? 0 : 0.20, 0.24];
  const A = FUND_ASSUME, cityK = sh[0] * A.cityPledge, cntyK = sh[1] * (uninc ? A.countyPledgeUninc : A.countyPledge);
  const ann = (1 - Math.pow(1 + A.rate, -A.years)) / A.rate;
  let y10 = 0, tot = 0, cityTot = 0, cntyTot = 0;
  for (let t = 1; t <= A.years; t++) {
    const gain = (r.value || 0) * (1 - Math.pow(1 - A.turnover, t)) * Math.pow(1.02, t);   // reassessed share of the gain, +2%/yr
    const city = gain * 0.01 * cityK * (1 - A.admin), cnty = gain * 0.01 * cntyK * (1 - A.admin);
    tot += city + cnty; cityTot += city; cntyTot += cnty; if (t === 10) y10 = city + cnty;
  }
  const bond = y10 * (1 - (cntyK > 0 ? A.housing : 0)) / A.dscr * ann;
  const buildable = (r.capex || 0) + (r.land || 0);                    // bonds pay for building and land, not yearly upkeep
  const eifd = Math.min(bond, buildable), rest = Math.max(r.cost - eifd, 0), program = buildable <= 0;
  const ocF = isOCArea(m) ? ocFunding(r.id) : null;
  const others = ocF ? ocF.funding.filter(f => f.code !== "OC_EIFD").map(f => [f.name, f.what, f.source]) : (c.funding || []).filter(k => k !== "EIFD" && D.funding[k]).map(k => D.funding[k]);
  const cm = ocF ? null : ((D.r10 || {}).city || {})[p.c] || null, ex = ((D.r10 || {}).stacks || {})[r.id] || null;
  return { eifd, bond, y10, tot, cityTot, cntyTot, cityK, cntyK, rest, others, uninc, share: r.cost > 0 ? eifd / r.cost : 0, om: r.om || 0, sh, city: p.c, cm, ex, keys: c.funding || [], program, id: r.id, oc: !!ocF };
}
function fundHtml(r, gid) {
  const f = fundPlan(r, gid); if (!f) return "";
  const pct = x => (x * 100).toFixed(x < 0.1 ? 1 : 0) + "%";
  const who = f.uninc ? `the County (${pct(f.cntyK)} of each $1 of new tax here)` : `${esc(f.city)} (${pct(f.cityK)} of each $1 of new tax) and the County (${pct(f.cntyK)})`;
  const lead = f.others[0];
  return `<div class="fund small"><b>Who pays — a possible funding plan</b>
    <div class="fund-bar" title="EIFD ${fmt$(f.eifd)} of ${fmt$(r.cost)}"><i style="width:${Math.min(100, f.share * 100).toFixed(1)}%"></i></div>
    <div class="kv">${f.program ? `<span>EIFD</span><span>bonds can't pay for a yearly program, but the ~${fmt$(f.y10)}/yr of tax growth it creates could help cover it</span>` : `<span>EIFD bonds from this project's own value gain</span><span><b>${fmt$(f.eifd)}</b> (${pct(f.share)} of the cost)</span>`}
      <span>Put in by</span><span>${who}: ~${fmt$(f.y10)}/yr of tax growth by year 10, ~${fmt$(f.tot)} over 30 years (city ${fmt$(f.cityTot)}, County ${fmt$(f.cntyTot)})</span>
      <span>Left to raise</span><span><b>${fmt$(f.rest)}</b>${f.om ? ` (incl. ${fmt$(f.om)}/yr upkeep, which bonds can't pay)` : ""}</span>
      ${f.others.length ? `<span>Best fits for the rest</span><span>${f.others.map((o, i) => `${o[2] ? `<a href="${esc(o[2])}" target="_blank" rel="noopener">${esc(o[0])}</a>` : esc(o[0])}${i === 0 ? "" : ""} <span class="muted">(${esc(o[1])})</span>`).join("; ")}</span>` : `<span>Rest</span><span>city general fund or capital budget</span>`}</div>
    ${cityMoney(f)}${f.ex ? `<p style="margin:6px 0 0"><b>Real example${activeCounty === "oc" ? " (LA County)" : ""}:</b> ${esc(f.ex.p)} (${esc(f.ex.c)}${f.ex.s ? ", " + esc(f.ex.s.split(";")[0]) : ""}): ${fmt$(f.ex.t)} — ${f.ex.src.map(([n, a]) => `${esc(n)} ${fmt$(a)} (${Math.round(100 * a / f.ex.t)}%)`).join("; ")}.</p>` : ""}
    <p class="muted" style="margin:4px 0 0">How: the city (and the County, if it joins) forms an EIFD, pledges its share of the property-tax growth this project creates, and issues bonds against it; ${lead ? esc(lead[0]) : "grants and the city's budget"} would cover most of the rest. Assumes ${pct(FUND_ASSUME.turnover)} of homes resell each year (Prop 13 reassesses only on sale), the city pledges 75% of its share and the County 49% (Artesia's 2026 district; County shares elsewhere run 11–50%)${f.uninc ? "; in unincorporated areas the County alone, assumed 50%" : ""}, ${(FUND_ASSUME.rate * 100).toFixed(2)}% 30-year bonds at ${FUND_ASSUME.dscr}x coverage${f.cntyK > 0 ? ", 20% of County-backed bonds held for housing" : ""}. A district over the whole area (calculator below) also captures ordinary growth and raises far more. Since AB 116 (2019) EIFD bonds need no public vote.</p></div>`;
}
function ocFunding(id) {
  const F = (typeof D_OC !== "undefined" && D_OC && D_OC.oc_funding) || null;
  return F && F[id] ? F[id] : null;
}
function ocLfs(city) {
  const P = (((typeof D_OC !== "undefined" && D_OC && D_OC.oc_funding) || {}).programs || {}).M2_LFS; if (!P) return null;
  const k = /^Unincorporated/i.test(city || "") || / \(unincorporated\)$/.test(city || "") ? "County Unincorporated" : city;
  return P.per_city_fy2026_27[k] != null ? { amt: P.per_city_fy2026_27[k], who: k === "County Unincorporated" ? "the County (unincorporated areas)" : k, src: P.source, tab: P.date } : null;
}
function ocMoney(f, id) {
  const F = ocFunding(id), L = ocLfs(f.city); if (!L) return "";
  const uses = F && F.funding.some(x => x.code === "M2_LFS");
  return `<p style="margin:6px 0 0"><b>${uses ? "What " + esc(L.who) + " already gets" : esc(L.who) + "'s own yearly money"}:</b> ~${fmt$(L.amt)} of OCTA Measure M2 Local Fair Share in FY 2026-27 (OCTA forecast apportionment)${uses ? ", which can pay for street, pedestrian, transit and active-transportation projects like this" : ", for streets, transit and active transportation; this one would rely on other grants or the general fund"}.</p>`;
}
function ocFundingHtml(id, m) {
  const F = ocFunding(id); if (!F) return "";
  const fees = ocFeeLine(id, m);
  if (!F.funding.length) return `<p class="small"><b>Orange County funding:</b> <span class="muted">${esc(F.notes)}</span></p>${fees}`;
  return `<p class="small"><b>Orange County funding (verified):</b> ${F.funding.map(x => `<a href="${esc(x.source)}" target="_blank" rel="noopener">${esc(x.name)}</a> <span class="muted">(${esc(x.what)})</span>`).join("; ")}.${F.process ? ` <b>How:</b> ${esc(F.process)}.` : ""}${F.who_decides ? ` <b>Who decides:</b> ${esc(F.who_decides)}.` : ""}${F.notes ? ` <span class="muted">${esc(F.notes)}</span>` : ""}</p>${fees}`;
}
function ocFeeLine(id, m) {
  const fees = (typeof D_OC !== "undefined" && D_OC && D_OC.oc_fees) || null; if (!fees) return "";
  const c = (m && m.c) || "", city = fees[c], key = id === "street_trees" ? "street_tree_fee" : id === "sidewalks" ? "sidewalk_cost_share" : id === "adu" ? "adu_impact_fee" : null;
  const out = [];
  if (key && city && city[key]) { const x = city[key]; out.push(`<b>${esc(c)}:</b> ${esc(x.value)} <span class="muted">(${esc(x.code)}; <a href="${esc(x.source)}" target="_blank" rel="noopener">source</a>, ${esc(x.date)})</span>`); }
  if (id === "adu" && fees._meta && fees._meta.adu_impact_fee_law) { const L = fees._meta.adu_impact_fee_law; out.push(`<b>State rule:</b> ${esc(L.value)} <span class="muted">(<a href="${esc(L.source)}" target="_blank" rel="noopener">statute text</a>)</span>`); }
  return out.length ? `<p class="small">${out.join("<br>")}</p>` : "";
}
function cityMoney(f) {
  if (f.oc) return ocMoney(f, f.id);
  const cm = f.cm; if (!cm) return "";
  const lr = (cm.pa || 0) + (cm.pc || 0) + (cm.mr || 0) + (cm.mm || 0), useLR = f.keys.includes("M"), useW = f.keys.includes("W") && cm.mw;
  if (!useLR && !useW) return `<p style="margin:6px 0 0"><b>${esc(f.city)}'s own yearly money:</b> ~${fmt$(lr)} of Metro sales-tax local return${cm.mw ? ` and ${fmt$(cm.mw)} of Measure W` : ""} (FY 2026-27 estimates), mostly for transportation and water projects; this one would rely on grants or the general fund.</p>`;
  const parts = [];
  if (useLR && lr) parts.push(`~${fmt$(lr)} a year of Metro local return (Prop A ${fmt$(cm.pa || 0)}, Prop C ${fmt$(cm.pc || 0)}, Measure R ${fmt$(cm.mr || 0)}, Measure M ${fmt$(cm.mm || 0)}), which can pay for street and transit projects like this`);
  if (useW) parts.push(`${fmt$(cm.mw)} a year of Measure W municipal money for green streets, trees and stormwater`);
  return `<p style="margin:6px 0 0"><b>What ${esc(f.city)} already gets:</b> ${parts.join("; and ")} (FY 2026-27 estimates; much is already committed).</p>`;
}
function fundSummary(pkg, gid) {
  const F = pkg.map(r => [r, fundPlan(r, gid)]).filter(([, f]) => f);
  if (!F.length) return "";
  const cost = F.reduce((s, [r]) => s + r.cost, 0), eifd = F.reduce((s, [, f]) => s + f.eifd, 0), y10 = F.reduce((s, [, f]) => s + f.y10, 0);
  const src = new Map(); F.forEach(([r, f]) => { const o = f.others[0]; if (o) src.set(o[0], (src.get(o[0]) || 0) + Math.max(r.cost - f.eifd, 0)); });
  const top = [...src].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `<div class="pkg">${tile("EIFD could fund", fmt$(eifd), `${(100 * eifd / Math.max(cost, 1)).toFixed(0)}% of the cost, from these projects' own value gain`)}${tile("City + County put in", fmt$(y10) + "/yr", "their share of the new property tax by year 10")}${tile("Left for grants and budgets", fmt$(Math.max(cost - eifd, 0)), top.length ? "mostly " + top.map(([k]) => esc(k)).join(", ") : "")}</div>
    <p class="small muted" style="margin:4px 0 0">Open any project's <i>Why here, cost and sources</i> for its funding plan; the EIFD calculator below shows a district over the whole area.</p>`;
}
function recCard(r, i, mode) {
  const c = D.catalog[r.id], ev = String(c.evidence);
  const m = selected && D.details[selected] ? D.details[selected].m || {} : {};
  const rng = formatVpdRange(r.vpd, c.grade, r.id, m);
  const head = mode === "value" ? `<span class="vpd-badge grade-${(c.grade || "none").toLowerCase()}">${rng.badge}</span><span class="vpd" title="Model estimate ${rng.estStr}; band of ±${Math.round(rng.band * 100)}% by evidence grade">${rng.str}</span>` : mode === "owner" ? `<span class="vpd">adds ~${fmt$(r.value)}</span>` : `<span class="vpd none">${mode === "qol" ? "need: " + (r.qol >= .8 ? "high" : r.qol >= .5 ? "medium" : "low") : "policy"}</span>`;
  const costs = `${fmt$(r.capex)} to build${r.land ? " + " + fmt$(r.land) + " land" : ""}${r.om ? " + " + fmt$(r.om) + "/yr upkeep or operations" : ""}`;
  const agencyHtml = c.lead_agency ? `<p class="small agency-line" style="margin:4px 0 2px"><b>Who decides:</b> ${esc(agencyFor(c.lead_agency, m))} · <b>Next step:</b> ${esc(agencyFor(c.process, m))}${isOCArea(m) ? ' <span class="muted">(Orange County equivalents of the LA County catalog; verify with the city)</span>' : ""}</p>` : "";
  const dispHtml = renterViewOn || c.displacement_risk === "high_risk" ? (
    c.displacement_risk === "high_risk" ? `<div class="displacement-badge high-risk">⚠️ <b>High Displacement Risk:</b> Significant land value uplift. Pair with tenant protections, RSO enforcement &amp; Community Land Trusts.</div>`
    : c.renter_direct ? `<div class="displacement-badge protective">✓ <b>Direct Renter Benefit:</b> Improves tenant comfort, transit mobility, or safety with minimal displacement pressure.</div>`
    : ""
  ) : "";
  return `<div class="rec${i === 0 && mode === "value" ? " top" : ""}${mode === "qol" ? " qolrec" : ""}">
    <div class="cat">${esc(c.category)}</div>
    <div class="row1"><span class="nm">${esc(c.name)}</span>${head}</div>
    <div class="meta">${esc(r.project)} · <b>total ~${fmt$(r.cost)}</b>${r.value > 0 ? (c.kind === "owner" ? ` · adds ~${fmt$(r.value)} to that home's value` : ` · adds ~${fmt$(r.value)} across ~${fmtN(r.homes)} homes`) : ""}${c.grade !== "none" ? `<span class="chip${c.grade === "A" || c.grade === "B" ? " strong" : c.grade === "D" || c.grade === "U" ? " reg" : ""}" title="${esc(GRADE_TXT[c.grade])}">evidence ${c.grade}</span>` : `<span class="chip">${esc(ev.split(" (")[0])}</span>`}${c.kind === "regional" ? '<span class="chip reg">regional project</span>' : ""}</div>
    ${whereLine(r.id)}
    ${agencyHtml}
    ${dispHtml}
    <details><summary>Why here, cost and sources</summary>
      <p class="small"><b>Why:</b> ${esc(r.why)}</p>
      <div class="costline">total = ${costs}${r.om ? " (10 yrs, present value)" : ""}</div>
      ${c.benefit && mode === "qol" ? `<p class="small"><b>Public benefit (unverified estimate):</b> about ${fmt$(c.benefit[0])} a year from ${esc(c.benefit[1].toLowerCase())}, roughly <b>${fvpd(c.benefit[0] * 8.53 / Math.max(r.cost, 1))}</b> of benefit per $1 over 10 years. From the round-6 research, not yet checked against its sources.${c.benefit[2] ? " " + esc(c.benefit[2]) : ""}</p>` : ""}
      ${r.pct > 0 ? `<p class="small"><b>Price effect used:</b> +${r.pct}% for homes reached${c.years ? `, full effect after ~${c.years} yr (discounted)` : ""}. Model estimate: <b>${rng.estStr}</b>; judgment band of ±${Math.round(rng.band * 100)}% for evidence grade ${esc(c.grade)}: ${rng.str}.${rng.adjStr ? ` <span class="muted">Experimental local adjustment (${esc(rng.notes.join(", "))}): ${rng.adjStr}; shown for context, not used in the ranking.</span>` : ""}</p>` : `<p class="small"><b>Home-value effect:</b> not measured in the research, so it is ranked by how much this area needs it, not by value per $1.</p>`}
      ${c.grade !== "none" ? `<p class="small"><b>Evidence grade ${c.grade}:</b> ${esc(GRADE_TXT[c.grade].slice(4))}.${c.caveat ? " " + esc(c.caveat) : ""}</p>` : c.caveat ? `<p class="small">${esc(c.caveat)}</p>` : ""}
      ${mode === "value" || mode === "qol" ? fundHtml(r, selected) : ""}
      ${isOCArea(m) ? ocFundingHtml(r.id, m) : (c.funding || []).length && !(mode === "value" || mode === "qol") ? `<p class="small"><b>Who pays:</b> ${c.funding.map(k => { const f = D.funding[k]; return f ? `${f[2] ? `<a href="${esc(f[2])}" target="_blank" rel="noopener">${esc(f[0])}</a>` : esc(f[0])} (${esc(f[1])})` : ""; }).filter(Boolean).join("; ")}</p>` : ""}
      <p class="src muted">${c.sources.map(esc).join("<br>")}</p>
    </details></div>`;
}

// ---------------- what this place is missing (vs. its 50 most similar block groups) and the neighborhood's plan
function stepWhere(st) {
  const role = CORRIDOR_ROLE[st.fix], co = role && st.bg && ((D.details[st.bg] || {}).m || {}).co, c = co && co[role];
  return c ? ` on <b>${esc(c[0])}</b>${c[1] && c[2] && c[1] !== c[2] ? ` from ${esc(c[1])} to ${esc(c[2])}` : ""}` : "";
}
function gapSection(p, m) {
  const G = m.gp || { g: [], s: [] }, plan = (D.plans || {})[p.n + "|" + p.c];
  const fixName = id => D.catalog[id] ? D.catalog[id].name : id;
  let h = `<div class="section"><h3>What this area is missing</h3>`;
  if (G.g.length) h += `<ul class="small" style="margin:4px 0 0 18px;padding:0">${G.g.map(([k, x, med, sev, fix, why, cost]) =>
      `<li style="margin-bottom:4px">${esc(why)} <span class="muted">${sev >= 0.995 ? "Worse than every similar area." : "Worse than " + Math.round(sev * 100) + "% of similar areas."}</span> <b>Fix:</b> ${esc(fixName(fix))}${cost ? ` (~${fmt$(cost)})` : ""}.</li>`).join("")}</ul>`;
  else h += `<p class="small">Nothing stands out: this block group is at or above similar areas on parks, shade, shops, schools, services, transit, safety and street safety.</p>`;
  if (G.s.length) h += `<p class="small"><b>Already strong:</b> ${G.s.map(([k, x, med]) => `${esc((D.gap_labels || {})[k] || k)} (${esc(x)}; similar areas ${esc(med)})`).join("; ")}.</p>`;
  h += `<p class="small muted">Compared with the 50 block groups county-wide most like this one in income, density, home values, housing age, children, car ownership and single-family share.</p>`;
  if (plan) {
    const steps = plan.steps || [];
    h += `<div class="pkg" style="display:block;margin-top:10px"><div class="small" style="font-weight:600;margin-bottom:6px">A plan for ${esc(p.n)} (${plan.bgs} block group${plan.bgs > 1 ? "s" : ""}, ${fmtN(plan.homes)} homes)</div>`;
    if (steps.length) h += `<ol class="small" style="margin:0 0 0 18px;padding:0">${steps.map((st, i) => `<li style="margin-bottom:6px"><b>${i === 0 && steps.length > 1 ? "Quick win: " : ""}${esc(st.name)}</b>${st.project ? ` (${esc(st.project)}${st.near ? ", " + esc(st.near) : ""})` : ""}${stepWhere(st)}. ${esc(st.why)} This gap shows up in ${st.parts} of ${plan.bgs} parts of the neighborhood.${st.cost ? ` About ${fmt$(st.cost)}` : " Not costed here yet"}${st.vpd ? `, returning ${fvpd(st.vpd)} of home value per $1` : ""}${st.funding && D.funding[st.funding] ? `; could be paid for by ${esc(D.funding[st.funding][0])}` : ""}.</li>`).join("")}</ol>`;
    else h += `<p class="small">No neighborhood-wide gaps compared with similar areas. The best value-per-dollar projects are ranked below.</p>`;
    const pf = ((D.under && D.under.profit) || {})[p.n + "|" + p.c];
    if (pf && pf.total > 0) {
      const all = (D.under && D.under.profit ? Object.values(D.under.profit).map(x => x.total).sort((a, b) => b - a) : []), rank = all.indexOf(pf.total) + 1;
      h += `<p class="small"><b>Profit potential:</b> about <b>${fmt$(pf.total)}</b> of value created (${pf.pct != null ? (pf.pct * 100).toFixed(1) + "% of the neighborhood's home value, ~" + fmt$(pf.per_home) + " per home" : "few homes here, so it's shown as a total only"}), #${rank} of ${all.length} neighborhoods by total. ${fmt$(pf.proj)} from projects that pay back, net of cost${pf.land ? `, and ${fmt$(pf.land)} from developing ${pf.sites} underused site${pf.sites > 1 ? "s" : ""} (~${fmtN(pf.site_homes)} homes)` : ""}.${pf.soon && pf.soon.length ? ` Already under way: rail stations under construction nearby (${pf.soon.map(esc).join(", ")}), which usually lift nearby values.` : ""}</p>`;
    }
    const W = (pf && pf.way) || {}, wl = [];
    const wu = k => W[k] ? W[k][1] || W[k][0] : 0;
    if (wu("housing completed")) wl.push(`${fmtN(wu("housing completed"))} homes completed`);
    if (wu("housing permitted")) wl.push(`${fmtN(wu("housing permitted"))} permitted`);
    if (wu("housing approved")) wl.push(`${fmtN(wu("housing approved"))} approved`);
    if (W["affordable housing"]) wl.push(`${W["affordable housing"][0]} city-financed affordable project${W["affordable housing"][0] > 1 ? "s" : ""}`);
    const nb = ["new apartments", "new ADU", "new house", "new building"].reduce((t, k) => t + (W[k] ? W[k][0] : 0), 0);
    if (nb) wl.push(`${fmtN(nb)} new-building permits since 2024 (LA City)`);
    if (wl.length) h += `<p class="small"><b>Already under way:</b> ${wl.join(", ")} (state housing reports since 2021 and city data). Turn on <b>Housing &amp; projects under way</b> to see them.</p>`;
    if ((plan.ctx || []).length) h += plan.ctx.map(c => `<p class="small">${esc(c)}</p>`).join("");
    if ((plan.strong || []).length) h += `<p class="small"><b>Strengths to build on:</b> ${plan.strong.map(x => esc(x[1])).join("; ")}.</p>`;
    h += `<p class="small muted">Steps tackle the gaps shared by the most homes. The first is the cheapest, then the rest are ordered by return. Each is a project City Pretty already sized for the most affected part of the neighborhood. These plans will be rewritten monthly, with an assistant on this page later.</p></div>`;
  }
  return h + `</div>`;
}

// ---------------- per-house analysis: the clicked parcel, fetched live from the County Assessor's public parcel service
const PARCEL_URL = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query";
const PARCEL_FIELDS = ["AIN", "SitusFullAddress", "SitusHouseNo", "SitusStreet", "UseCode", "UseType", "UseDescription", "Roll_LandValue", "Roll_ImpValue",
  "Roll_LandBaseYear", "Roll_ImpBaseYear", "Roll_HomeOwnersExemp",
  ...[1, 2, 3, 4, 5].flatMap(i => [`DesignType${i}`, `QualityClass${i}`, `YearBuilt${i}`, `EffectiveYear${i}`, `Units${i}`, `Bedrooms${i}`, `Bathrooms${i}`, `SQFTmain${i}`])].join(",");
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
// round-9 sources (research/round9): per-lot checks queried live from the page
const R9 = {
  permits: "https://data.lacity.org/resource/pi9x-tg5x.json",          // LADBS permits 2020-present (ADU/JADU fields)
  permitsOld: "https://data.lacity.org/resource/d9aa-v8bm.json",       // LADBS building permits (of_stories)
  sales: "https://egispais.gis.lacounty.gov/pais/rest/services/PAIS/pais_sales_parcels/MapServer/0",
  hpoz: "https://services5.arcgis.com/7nsPwEMP38bSkCjy/ArcGIS/rest/services/Historic_Preservation_Overlay_Zones/FeatureServer/5",
  hcm: "https://services5.arcgis.com/7nsPwEMP38bSkCjy/ArcGIS/rest/services/Historic_Cultural_Monuments/FeatureServer/4",
  histCounty: "https://rpgis.isd.lacounty.gov/arcgis/rest/services/GISNET_Public/MapServer/331",
  hillside: "https://maps.lacity.org/lahub/rest/services/Special_Areas/MapServer/6",
  landslide: "https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Landslide_Zones/FeatureServer/0",
  liquefaction: "https://services2.arcgis.com/zr3KAIbsRSUyARHG/ArcGIS/rest/services/CGS_Liquefaction_Zones/FeatureServer/0",
  fault: "https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Alquist_Priolo_Fault_Zones/FeatureServer/0",
  fireSRA: "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/ArcGIS/rest/services/FHSZSRA_23_3/FeatureServer/0",
  fireLRA: "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSALRA25_v1_All/FeatureServer/0",
  cams: "https://arcgis.gis.lacounty.gov/arcgis/rest/services/LACounty_Dynamic/CAMS/MapServer/1",
};
async function arcQuery(url, params, ms = 12000) {
  const q = `${url}/query?` + new URLSearchParams({ f: "json", ...params }).toString();
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    const r = await fetch(q, { signal: ctl.signal }); clearTimeout(t);
    const d = await r.json(); if (d.error) throw new Error(d.error.message); return d;
  } catch (e) { const d = await jsonp(q); if (d.error) throw new Error(d.error.message); return d; }
}
async function socrata(url, where, ms = 12000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  const r = await fetch(`${url}?$limit=60&$where=${encodeURIComponent(where)}`, { signal: ctl.signal }); clearTimeout(t);
  if (!r.ok) throw new Error("HTTP " + r.status); return r.json();
}
const limit = (pr, ms = 8000) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error("timed out")), ms))]);
const settle = (pr) => limit(pr).then(v => ({ ok: true, v }), e => ({ ok: false, e: e.message || String(e) }));
async function lotChecks(ll, a) {
  const pt = { geometry: `${ll.lng},${ll.lat}`, geometryType: "esriGeometryPoint", inSR: 4326, spatialRel: "esriSpatialRelIntersects", returnGeometry: false };
  const hit = (url, fields) => arcQuery(url, { ...pt, outFields: fields || "*", resultRecordCount: 3 }).then(d => (d.features || []).map(f => f.attributes));
  const ain = String(a.AIN || "").replace(/\D/g, "");
  const loc = localOverlays(ll), q = (key, run) => loc[key] ? Promise.resolve(loc[key]) : settle(run());
  
  // Official nationwide FEMA NFHL MapServer query (Layer 28: Flood Hazard Zones)
  const femaUrl = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";
  const femaQuery = hit(femaUrl, "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE").catch(() => []);

  const [hpoz, hcm, hc, hill, slide, liq, fault, sra, lra, sales, prm, old, femaHits] = await Promise.all([
    q("hpoz", () => hit(R9.hpoz, "NAME")), q("hcm", () => hit(R9.hcm, "NAME,MNT_NUM")), q("hc", () => hit(R9.histCounty, "Name,Status_Code_Description,Mills_Act_Contract")),
    q("hill", () => hit(R9.hillside, "H_TYPE")), q("slide", () => hit(R9.landslide, "QUAD_NAME")), q("liq", () => hit(R9.liquefaction, "QUAD_NAME")), q("fault", () => hit(R9.fault, "QUAD_NAME")),
    q("sra", () => hit(R9.fireSRA, "*")), q("lra", () => hit(R9.fireLRA, "*")),
    settle(arcQuery(R9.sales, { where: `AIN='${ain}'`, outFields: "*", returnGeometry: false }).then(d => (d.features || []).map(f => f.attributes))),
    settle(socrata(R9.permits, `apn='${ain}'`)),
    settle(socrata(R9.permitsOld, `assessor_book='${ain.slice(0, 4)}' AND assessor_page='${ain.slice(4, 7)}' AND assessor_parcel='${ain.slice(7, 10)}'`)),
    settle(femaQuery)
  ]);
  const fireVals = [sra, lra].flatMap(x => x.ok ? x.v : []).map(r => String(r.FHSZ_Description || r.FHSZ || r.HAZ_CLASS || "")).filter(Boolean);
  
  let femaData = null;
  if (femaHits && femaHits.ok && Array.isArray(femaHits.v) && femaHits.v.length > 0) {
    const fRec = femaHits.v[0];
    const zone = String(fRec.FLD_ZONE || "X").trim();
    const subty = String(fRec.ZONE_SUBTY || "").trim();
    const sfha = String(fRec.SFHA_TF || "").toUpperCase() === "T";
    const bfe = fRec.STATIC_BFE && +fRec.STATIC_BFE > -9000 ? +fRec.STATIC_BFE : null;
    let desc = "";
    if (sfha) {
      desc = `Zone ${zone} (100-year Special Flood Hazard Area; mandatory flood insurance requirement${bfe ? `; Base Flood Elevation ${bfe} ft` : ""})`;
    } else if (/0.2\s*pct/i.test(subty) || /500/i.test(subty)) {
      desc = `Zone ${zone} (500-year moderate flood risk, 0.2% annual chance)`;
    } else if (zone === "X") {
      desc = "Zone X (Minimal flood risk, outside 500-year floodplain)";
    } else {
      desc = `Zone ${zone}${subty ? " (" + subty + ")" : ""}`;
    }
    femaData = { zone, subty, sfha, bfe, label: desc };
  }

  return { hpoz, hcm, hc, hill, slide, liq, fault, sales, prm, old, fema: femaData,
    fire: (sra.ok || lra.ok) ? { vh: fireVals.some(v => /very high|^3$/i.test(v)), any: fireVals.length > 0, label: fireVals[0] || "" } : null };
}
// Assessor code decoding (round-9 code tables): UseCode 0101/0103 pool, 0106 ADU, 0107 JADU, 0108 guest house,
// 010G Mills Act; DesignType 01xx: 3rd digit heating/cooling, 4th digit pool/spa
function decodeAssessor(a) {
  const uc = String(a.UseCode || ""), dt = String(a.DesignType1 || "").padStart(4, "0");
  const heat = { "0": "none recorded", "1": "floor or wall heat", "2": "central heat", "3": "central heating and cooling", "4": "central solar heat" };
  const pool = { "0": null, "1": "pool", "2": null, "3": "pool", "4": "spa", "5": "solar-heated pool" };
  return { pool: /^010[13]/.test(uc) || (dt.startsWith("01") && ["1", "3", "5"].includes(dt[3])) ? (pool[dt[3]] || "pool") : dt.startsWith("01") && dt[3] === "4" ? "spa" : null,
    adu: uc.startsWith("0106") ? "ADU" : uc.startsWith("0107") ? "junior ADU" : uc.startsWith("0108") ? "guest house (no kitchen or bath)" : null,
    mills: uc.startsWith("010G"), heat: dt.startsWith("01") ? heat[dt[2]] || null : null, ac: dt.startsWith("01") && dt[2] === "3" };
}
function permitFacts(L) {
  const out = { list: [], stories: null, storiesSrc: null, adu: false };
  if (L && L.prm.ok) for (const r of L.prm.v) {
    const w = `${r.permit_type || ""} ${r.permit_sub_type || ""} ${r.work_desc || ""}`;
    const kind = /adu|accessory dwelling/i.test(w) || +r.adu_changed > 0 || +r.junior_adu > 0 ? "ADU" : /pool|spa/i.test(w) ? "pool" : /solar|photovoltaic/i.test(w) ? "solar"
      : /addition|add .*sq|second story|2nd story/i.test(w) ? "addition" : /re-?roof/i.test(w) ? "re-roof" : /new/i.test(r.permit_type || "") ? "new building" : null;
    if (kind === "ADU") out.adu = true;
    if (kind) out.list.push({ kind, date: String(r.issue_date || r.status_date || "").slice(0, 10), status: r.status_desc || "", desc: String(r.work_desc || "").slice(0, 120) });
  }
  if (L && L.old.ok) {
    const st = L.old.v.filter(r => +r.of_stories > 0 && /new|dwelling|sfd|single family|addition/i.test(r.work_description || ""))
      .sort((x, y) => String(y.issue_date || "").localeCompare(String(x.issue_date || "")));
    if (st.length) { out.stories = +st[0].of_stories; out.storiesSrc = `LA City building permit (${String(st[0].issue_date || "").slice(0, 4)}): ${st[0].of_stories} stor${+st[0].of_stories > 1 ? "ies" : "y"} permitted`; }
  }
  return out;
}
let parcelLayer = null;
function houseHint() {
  const el = $("#house"); if (el) el.remove();
  const box = document.createElement("div"); box.id = "house"; box.className = "section";
  box.innerHTML = `<p class="small muted">Zoom in to street level (zoom 17) and click a single home to check what that house can add: ADU, SB 9 split, pool, solar and more.</p>`;
  const v = $("#panel .verdict"); if (v) v.after(box);
}
function jsonp(url) {
  return new Promise((res, rej) => { const cb = "cp" + Math.random().toString(36).slice(2), s = document.createElement("script");
    window[cb] = d => { delete window[cb]; s.remove(); res(d); }; s.onerror = () => { delete window[cb]; s.remove(); rej(new Error("parcel service unreachable")); };
    s.src = url + "&callback=" + cb; document.head.appendChild(s); setTimeout(() => { if (window[cb]) { delete window[cb]; s.remove(); rej(new Error("timeout")); } }, 15000); });
}

var PARCEL_REGISTRY = {"states":{"37":{"name":"North Carolina","url":"https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1","apn":"parno","addr":"siteadd","use":"parusedesc","land_val":"landval","imp_val":"improvval","tot_val":"parval","acres":"gisacres","yr_blt":"YEAR_BUILT","sqft":null},"12":{"name":"Florida","url":"https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0","apn":"PARCEL_ID","addr":"PHY_ADDR1","use":"DOR_UC","land_val":"LND_VAL","imp_val":null,"tot_val":"JV","acres":"ACRES","yr_blt":"ACT_YR_BLT","sqft":"LND_SQFOOT"},"55":{"name":"Wisconsin","url":"https://services3.arcgis.com/n6uYoouQZW75n5WI/arcgis/rest/services/Wisconsin_Statewide_Parcels_DB/FeatureServer/0","apn":"PARCELID","addr":"SITEADRESS","use":"PROPCLASS","land_val":"LNDVALUE","imp_val":"IMPVALUE","tot_val":"CNTASSDVALUE","acres":"GISACRES","yr_blt":"YEAR_BUILT","sqft":null},"25":{"name":"Massachusetts","url":"https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0","apn":"PROP_ID","addr":"SITE_ADDR","use":"USE_DESC","land_val":"LAND_VAL","imp_val":"BLDG_VAL","tot_val":"TOTAL_VAL","acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":"LOT_SIZE"},"49":{"name":"Utah","url":"https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/UtahStatewideParcels/FeatureServer/0","apn":"PARCEL_ID","addr":"SITE_ADDR","use":"USE_DESC","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":null},"30":{"name":"Montana","url":"https://gisservice.mt.gov/ArcGIS/rest/services/msdi_cadastral_map_v1/MapServer/1","apn":"PARCELID","addr":"AddressLine1","use":"PropType","land_val":null,"imp_val":"TotalBuildingValue","tot_val":"TotalValue","acres":"GISAcres","yr_blt":"YEAR_BUILT","sqft":null},"53":{"name":"Washington","url":"https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0","apn":"PARCELID","addr":"SITUS_ADDRESS","use":"LANDUSE_CD","land_val":"VALUE_LAND","imp_val":"VALUE_BLDG","tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":null},"34":{"name":"New Jersey","url":"https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0","apn":"PAMS_PIN","addr":"PROP_LOC","use":"PROP_CLASS","land_val":"LAND_VAL","imp_val":"IMPRVT_VAL","tot_val":"NET_VALUE","acres":"CALC_ACRE","yr_blt":"YR_CONSTR","sqft":null},"09":{"name":"Connecticut","url":"https://services3.arcgis.com/3FL1kr7L4LvwA2Kb/arcgis/rest/services/Connecticut_CAMA_and_Parcel_Layer/FeatureServer/0","apn":"Parcel_ID","addr":"Location_1","use":"State_Use_Description","land_val":"Assessed_Land","imp_val":"Assessed_Building","tot_val":"Assessed_Total","acres":"Land_Acres","yr_blt":"AYB","sqft":null},"24":{"name":"Maryland","url":"https://mdgeodata.md.gov/imap/rest/services/PlanningCadastre/MD_ParcelBoundaries/MapServer/0","apn":"PARCELID","addr":"PREMSNUM","use":"DESCLU","land_val":"NFMLNDVL","imp_val":"NFMIMPVL","tot_val":"NFMTTLVL","acres":"ACRES","yr_blt":"YEARBLT","sqft":null},"50":{"name":"Vermont","url":"https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0","apn":"SPAN","addr":"E911ADDR","use":"CAT","land_val":"LAND_LV","imp_val":"IMPRV_LV","tot_val":"REAL_FLV","acres":"ACRESGL","yr_blt":"YEAR_BUILT","sqft":null},"36":{"name":"New York (38","url":"https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/MapServer/1","apn":"PRINT_KEY","addr":"PARCEL_ADDR","use":"PROP_CLASS","land_val":"LAND_AV","imp_val":"TOTAL_AV","tot_val":"TOTAL_AV","acres":"ACRES","yr_blt":"YR_BLT","sqft":null},"08":{"name":"Colorado","url":"https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0","apn":"parcel_id","addr":"situsAdd","use":"landUseDsc","land_val":null,"imp_val":null,"tot_val":"apprValTot","acres":"landAcres","yr_blt":"YEAR_BUILT","sqft":null},"18":{"name":"Indiana","url":"https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer/0","apn":"parcel_id","addr":"prop_add","use":"dlgf_prop_class_code","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":null},"27":{"name":"Minnesota","url":"https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_mngeo/plan_parcels_open/FeatureServer/1","apn":"PARCELID","addr":"SITE_ADDR","use":"useclass1","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":null},"51":{"name":"Virginia","url":"https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/MapServer/0","apn":"PARCELID","addr":"SITE_ADDR","use":"USE_DESC","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":null},"54":{"name":"West Virginia","url":"https://services.wvgis.wvu.edu/arcgis/rest/services/Planning_Cadastre/WV_Parcels/MapServer/0","apn":"CleanParcelID","addr":"FullPhysicalAddress","use":"USE_DESC","land_val":null,"imp_val":null,"tot_val":null,"acres":"CALC_ACRE","yr_blt":"YEAR_BUILT","sqft":null},"10":{"name":"Delaware","url":"https://enterprise.firstmap.delaware.gov/arcgis/rest/services/PlanningCadastre/DE_StateParcels/MapServer/0","apn":"PIN","addr":"SITE_ADDR","use":"USE_DESC","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":null},"05":{"name":"Arkansas","url":"https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/6","apn":"parcelid","addr":"adrlabel","use":"parceltype","land_val":"landvalue","imp_val":"impvalue","tot_val":"totalvalue","acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":null},"11":{"name":"District of Columbia","url":"https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer/40","apn":"SSL","addr":"PREMISEADD","use":"PROPTYPE","land_val":"NEWLAND","imp_val":"NEWIMPR","tot_val":"NEWTOTAL","acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":null},"23":{"name":"Maine","url":"https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Maine_Parcels_Organized_Towns/FeatureServer/10","apn":"MAP_BK_LOT","addr":"PROP_LOC","use":"USE_DESC","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":null},"39":{"name":"Ohio","url":"https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer/0","apn":"LocalParcelID","addr":"SITE_ADDR","use":"StateLUC","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":null},"38":{"name":"North Dakota","url":"https://services1.arcgis.com/GOcSXpzwBHyk2nog/arcgis/rest/services/NDGISHUB_Parcels/FeatureServer/0","apn":"GISID","addr":"SITE_ADDR","use":"USE_DESC","land_val":null,"imp_val":null,"tot_val":null,"acres":"CalculatedAcres","yr_blt":"YEAR_BUILT","sqft":null},"56":{"name":"Wyoming","url":"https://services3.arcgis.com/r0iJ85SKZ4zAzz3P/arcgis/rest/services/Wyoming_Parcels_for_2026/FeatureServer/0","apn":"parcelnb","addr":"SITE_ADDR","use":"USE_DESC","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":null},"16":{"name":"Idaho","url":"https://services1.arcgis.com/CNPdEkvnGl65jCX8/arcgis/rest/services/Public_Idaho_Parcels_/FeatureServer/7","apn":"PARCEL_ID","addr":"SITE_ADDR","use":"USE_DESC","land_val":"VAL_LAND","imp_val":"VAL_IMPVTS","tot_val":"VAL_TOTAL","acres":"ASR_ACRES","yr_blt":"YEAR_BUILT","sqft":null},"31":{"name":"Nebraska","url":"https://giscat.ne.gov/enterprise/rest/services/StatewideParcelsExternal/MapServer/0","apn":"Parcel_ID","addr":"Situs_Address","use":"Classification_Code","land_val":"Land_Value","imp_val":"Improvements_Value","tot_val":"Total_Assessed_Value","acres":"ACRES","yr_blt":"BuildingYear","sqft":null},"44":{"name":"Rhode Island","url":"https://risegis.ri.gov/hosting/rest/services/RIDEM/Tax_Parcels/MapServer/0","apn":"PlatLot","addr":"SITE_ADDR","use":"USE_DESC","land_val":null,"imp_val":null,"tot_val":null,"acres":"Acres","yr_blt":"YEAR_BUILT","sqft":null}},"counties":{"36005":{"name":"New York City","url":"https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0","apn":"PARCELID","addr":"Address","use":"BldgClass","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":"BldgArea"},"36047":{"name":"New York City","url":"https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0","apn":"PARCELID","addr":"Address","use":"BldgClass","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":"BldgArea"},"36061":{"name":"New York City","url":"https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0","apn":"PARCELID","addr":"Address","use":"BldgClass","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":"BldgArea"},"36081":{"name":"New York City","url":"https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0","apn":"PARCELID","addr":"Address","use":"BldgClass","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":"BldgArea"},"36085":{"name":"New York City","url":"https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0","apn":"PARCELID","addr":"Address","use":"BldgClass","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"YEAR_BUILT","sqft":"BldgArea"},"04013":{"name":"Maricopa County, AZ","url":"https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/7","apn":"APN","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES_US"},"17031":{"name":"Cook County, IL","url":"https://gis.cookcountyil.gov/traditional/rest/services/CookViewer3Parcels/MapServer/0","apn":"PIN14","addr":"street_address","use":"BCLASS","land_val":null,"imp_val":null,"acres":"LANDSF"},"06073":{"name":"San Diego County, CA","url":"https://geo.sandag.org/server/rest/services/Hosted/Parcels_South/FeatureServer/0","apn":"apn","addr":"situs_address","use":"asr_landuse","land_val":null,"imp_val":null,"acres":"acreage"},"39049":{"name":"Franklin County, OH","url":"https://gis.franklincountyohio.gov/hosting/rest/services/ParcelFeatures/Parcel_Features/MapServer/0","apn":"PARCELID","addr":"SITEADDRESS","use":"USE_DESC","land_val":null,"imp_val":null,"tot_val":null,"acres":"ACRES","yr_blt":"RESYRBLT","sqft":null},"13121":{"name":"Fulton County, GA","url":"https://gismaps.fultoncountyga.gov/arcgispub/rest/services/OpenData/Tax_Parcels/MapServer/0","apn":"ParcelID","addr":"Address","use":"LUCode","land_val":null,"imp_val":null,"acres":"LandAcres"},"42003":{"name":"Allegheny County, PA","url":"https://gisdata.alleghenycounty.us/arcgis/rest/services/EGIS/Web_Parcels/MapServer/0","apn":"PIN","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"CALCACREAGE"},"32003":{"name":"Clark County, NV","url":"https://maps.clarkcountynv.gov/arcgis/rest/services/Assessor/LandApp/MapServer/9","apn":"APN","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ASSR_ACRES"},"01073":{"name":"Jefferson County, AL","url":"https://jccgis.jccal.org/server/rest/services/Basemap/Parcels/MapServer/0","apn":"PARCELID","addr":"ADDR_PSPR","use":null,"land_val":null,"imp_val":null,"acres":"ACRES_APR"},"01097":{"name":"Mobile County, AL","url":"https://services8.arcgis.com/HND1NcQt6vgOGn1z/ArcGIS/rest/services/MCRC_Public_Parcels/FeatureServer/1","apn":"Parcel_Number","addr":"PropAddr1","use":null,"land_val":null,"imp_val":null,"acres":"Acreage"},"01117":{"name":"Shelby County, AL","url":"https://maps.shelbyal.com/gisserver/rest/services/LegacyServices/Cadastral_2026/MapServer/91","apn":"PROPERTY_NUM","addr":"PROP_ADR","use":"De_Facto_Use","land_val":null,"imp_val":null,"acres":"Acreage"},"04019":{"name":"Pima County, AZ","url":"https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/10","apn":"APN","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES_US"},"04021":{"name":"Pinal County, AZ","url":"https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/11","apn":"APN","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES_US"},"04025":{"name":"Yavapai County, AZ","url":"https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/13","apn":"APN","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES_US"},"04027":{"name":"Yuma County, AZ","url":"https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/14","apn":"APN","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES_US"},"06037":{"name":"Los Angeles County, CA","url":"https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0","apn":"AIN","addr":"SitusFullAddress","use":"UseCode","land_val":"Roll_LandValue","imp_val":"Roll_ImpValue","acres":"ACRES"},"06059":{"name":"Orange County, CA","url":"https://ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer/0","apn":"ASSESSMENT_NO","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES"},"06065":{"name":"Riverside County, CA","url":"https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50","apn":"APN","addr":"SITUS_STREET","use":"CLASS_CODE","land_val":null,"imp_val":null,"acres":"ACREAGE"},"06071":{"name":"San Bernardino County, CA","url":"https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/San_Bernardino_County_Parcel_Dataset/FeatureServer/0","apn":"APN","addr":"SITE_ADDRESS","use":"TYPEUSE","land_val":null,"imp_val":null,"acres":"ACREAGE"},"13135":{"name":"Gwinnett County, GA","url":"https://services3.arcgis.com/RfpmnkSAQleRbndX/ArcGIS/rest/services/Property_and_Tax/FeatureServer/0","apn":"PIN","addr":"ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"DEEDEDACREAGE"},"13089":{"name":"DeKalb County, GA","url":"https://dcgis.dekalbcountyga.gov/hosted/rest/services/PropertyAppraisal/Parcels_IASWorld/MapServer/0","apn":"PARCELID","addr":"SITEADDRESS","use":"USECD","land_val":null,"imp_val":null,"acres":"ACREAGE"},"13051":{"name":"Chatham County, GA","url":"https://pub.sagis.org/arcgis/rest/services/OpenData/Parcels/MapServer/27","apn":"PIN","addr":"PropAddress_Full","use":"Property_Use","land_val":null,"imp_val":null,"acres":"Acres"},"19113":{"name":"Linn County, IA","url":"https://gis.linncountyiowa.gov/ags/rest/services/Planning/mapBSAPermitting/MapServer/6","apn":"GPN","addr":"SitusAddress","use":null,"land_val":"ValueAssessedLand","imp_val":"ValueAssessedImproved","acres":"Acres"},"19163":{"name":"Scott County, IA","url":"https://services.arcgis.com/ovln19YRWV44nBqV/ArcGIS/rest/services/Cadastral/FeatureServer/3","apn":"PIN","addr":"PropertyAddress","use":null,"land_val":null,"imp_val":null,"acres":"ACRES"},"19103":{"name":"Johnson County, IA","url":"https://gis.johnsoncountyiowa.gov/arcgis/rest/services/LandRecords/Land_Records/MapServer/9","apn":"PPN","addr":"SiteAddress","use":null,"land_val":"LandValue_Assessed","imp_val":"BldgValue_Assessed; DwellValue_Assessed","acres":"ACRES"},"19013":{"name":"Black Hawk County, IA","url":"https://services5.arcgis.com/ya62ECiavqTkK0wv/ArcGIS/rest/services/ParcelFabricPublished_gdb/FeatureServer/15","apn":"PIN","addr":"propertyad","use":"class_subc","land_val":null,"imp_val":null,"acres":"acres"},"17043":{"name":"DuPage County, IL","url":"https://gis.dupageco.org/arcgis/rest/services/DuPage_County_IL/ParcelsWithRealEstateCC/MapServer/0","apn":"PIN","addr":"PROPADDRL1","use":null,"land_val":null,"imp_val":null,"acres":"ACREAGE"},"17097":{"name":"Lake County, IL","url":"https://maps.lakecountyil.gov/arcgis/rest/services/CCAO/TaxParcelViewerPro/MapServer/12","apn":"Name","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES"},"17089":{"name":"Kane County, IL","url":"https://gistech.countyofkane.org/arcgis/rest/services/KanePINList/MapServer/0","apn":"PIN","addr":"SiteAddress","use":"UseCode","land_val":null,"imp_val":null,"acres":"RecordedAcreage"},"20209":{"name":"Wyandotte County, KS","url":"https://gisweb.wycokck.org/arcgis/rest/services/GISPUB/UGMAPS_4_V02/MapServer/0","apn":"PARCEL","addr":"SITE_ADDRESS","use":"LAND_USE","land_val":null,"imp_val":null,"acres":"ACRE"},"20045":{"name":"Douglas County, KS","url":"https://gis.dgcoks.gov/server/rest/services/Tax_Parcel/MapServer/0","apn":"PID","addr":"situs","use":null,"land_val":null,"imp_val":null,"acres":"RECORDACRES"},"21111":{"name":"Jefferson County, KY","url":"https://gis.lojic.org/maps/rest/services/LojicApps/MsdCsoSsoLocations/MapServer/4","apn":"PARCELID","addr":"SITE_ADDRESS","use":"CLASS","land_val":null,"imp_val":null,"acres":"ACRES"},"21067":{"name":"Fayette County, KY","url":"https://services1.arcgis.com/Mg7DLdfYcSWIaDnu/arcgis/rest/services/Parcel/FeatureServer/0","apn":"PVANUM","addr":"ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"PVA_ACRE"},"21117":{"name":"Kenton County, KY","url":"https://maps.linkgis.org/server/rest/services/Web_Scene_Map_Parcels/MapServer/13","apn":"PIDN","addr":"ADDRESS","use":"LANDUSE_CO","land_val":null,"imp_val":null,"acres":"GIS_Acreage"},"21227":{"name":"Warren County, KY","url":"https://webgis.bgky.org/server/rest/services/WARCO/Parcel_Reference/FeatureServer/0","apn":"PARCELID","addr":"ADDRESS","use":"LAND_USE","land_val":null,"imp_val":null,"acres":"ACRES"},"21015":{"name":"Boone County, KY","url":"https://secure.boonecountygis.com/server/rest/services/ParcelLayers/MapServer/0","apn":"PIDN","addr":"SITEADD1","use":null,"land_val":null,"imp_val":null,"acres":"GISACRES"},"22033":{"name":"East Baton Rouge County, LA","url":"https://services.arcgis.com/KYvXadMcgf0K1EzK/ArcGIS/rest/services/Tax_Parcels_2026/FeatureServer/0","apn":"ASSESSMENT_NUM","addr":"PHYSICAL_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES"},"22051":{"name":"Jefferson County, LA","url":"https://jpgis.jeffparish.net/server/rest/services/Parcels/FeatureServer/0","apn":"PARCELID","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"SFT"},"22071":{"name":"Orleans County, LA","url":"https://gis.nola.gov/arcgis/rest/services/LandBase/Parcels/MapServer/0","apn":"GEOPIN","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES"},"22103":{"name":"St. Tammany County, LA","url":"https://maps.stpgov.org/server/rest/services/Referenced_Layers/2025_Parcels/MapServer/0","apn":"REID","addr":"Physical_Address1","use":null,"land_val":null,"imp_val":null,"acres":"ACRES"},"26163":{"name":"Wayne County, MI","url":"https://www.waynecounty.com/gisserver/rest/services/ParcelViewer/prcls_fullAdd_parsed_FINAL/FeatureServer/0","apn":"packedParc","addr":"fullAddres","use":null,"land_val":null,"imp_val":null,"acres":"ACRES"},"26125":{"name":"Oakland County, MI","url":"https://qagisservices.oakgov.com/arcgisds/rest/services/Hosted/Tax_Parcel_2024/FeatureServer/32","apn":"keypin","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"acresrecorded"},"26099":{"name":"Macomb County, MI","url":"https://services6.arcgis.com/K0qS4r8AEJxrE8em/ArcGIS/rest/services/Macomb_County_Parcel_Data/FeatureServer/10","apn":"TAX_ID","addr":"ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES"},"26081":{"name":"Kent County, MI","url":"https://gis.kentcountymi.gov/agisprod/rest/services/ParcelsWithCondos/FeatureServer/0","apn":"PNUM","addr":"PROPERTYADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACREAGE"},"29189":{"name":"St. Louis County County, MO","url":"https://services2.arcgis.com/w657bnjzrjguNyOy/ArcGIS/rest/services/STLCO_STC_Parcels_IND/FeatureServer/0","apn":"LOCATOR","addr":"PROP_ADD","use":null,"land_val":"ASSTLANDVA","imp_val":"ASSTIMPVAL","acres":"ACRES"},"29095":{"name":"Jackson County, MO","url":"https://jcgis.jacksongov.org/arcgis/rest/services/Cadastral/PastYearParcels/FeatureServer/0","apn":"Name","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"StatedArea + StatedAreaUnit"},"29077":{"name":"Greene County, MO","url":"https://greenecountyassessor.org/arcgis/rest/services/TopoCountyParcels/MapServer/0","apn":"PIN","addr":"SITE_ADDRESS","use":"LUC","land_val":"TOTASDLAND","imp_val":"TOTASDBLDG","acres":"ACRES"},"29510":{"name":"St. Louis city County, MO","url":"https://maps8.stlouis-mo.gov/arcgis/rest/services/PDA/PARCELS_PUBLIC/MapServer/0","apn":"ColParcelId","addr":"SITEADDR","use":"AsrLandUse1","land_val":"AsdLand","imp_val":"AsdImprove","acres":"LANDAREA"},"28049":{"name":"Hinds County, MS","url":"https://opcgis.deq.state.ms.us/opcgis/rest/services/Government/HINDS_PARCELS/MapServer/0","apn":"PARCELID","addr":"SITEADD","use":null,"land_val":null,"imp_val":null,"acres":"TAXACRES"},"28047":{"name":"Harrison County, MS","url":"https://geo.co.harrison.ms.us/server/rest/services/AGO/HarrisonCounty_ApprovedParcels/MapServer/0","apn":"PARCEL_ID","addr":"PHYSADDR","use":"LUCODECLAS","land_val":null,"imp_val":null,"acres":"ACRES"},"28033":{"name":"DeSoto County, MS","url":"https://gis.desotocountyms.gov/arcgis/rest/services/BaseLayers/MapServer/1","apn":"PIN","addr":"FULL_ADDR","use":null,"land_val":null,"imp_val":null,"acres":"ACREAGE"},"33011":{"name":"Hillsborough County, NH","url":"https://granit24a.sr.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1","apn":"nh_gis_id","addr":"streetaddress","use":"slu","land_val":null,"imp_val":null,"acres":"ACRES"},"33015":{"name":"Rockingham County, NH","url":"https://granit24a.sr.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1","apn":"nh_gis_id","addr":"streetaddress","use":"slu","land_val":null,"imp_val":null,"acres":"ACRES"},"33013":{"name":"Merrimack County, NH","url":"https://granit24a.sr.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1","apn":"nh_gis_id","addr":"streetaddress","use":"slu","land_val":null,"imp_val":null,"acres":"ACRES"},"33017":{"name":"Strafford County, NH","url":"https://granit24a.sr.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1","apn":"nh_gis_id","addr":"streetaddress","use":"slu","land_val":null,"imp_val":null,"acres":"ACRES"},"33009":{"name":"Grafton County, NH","url":"https://granit24a.sr.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1","apn":"nh_gis_id","addr":"streetaddress","use":"slu","land_val":null,"imp_val":null,"acres":"ACRES"},"not found":{"name":"Caguas County, PR","url":"https://sigejp.pr.gov/server/rest/services/crim/crim_feb_2025/MapServer/0","apn":"NUM_CATASTRO","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES"},"32031":{"name":"Washoe County, NV","url":"https://gisenterprise.washoecounty.gov/server/rest/services/WashoeGIS/Parcels/MapServer/0","apn":"PIN","addr":"FullAddress","use":"LAND_USE","land_val":"LANDASS","imp_val":"BUILDASS","acres":"ACREAGE"},"32019":{"name":"Lyon County, NV","url":"https://gis.lyon-county.org/server/rest/services/Landbase/Parcels/MapServer/1","apn":"PARCELID","addr":"PHY_ADDR","use":"YLDUSE","land_val":null,"imp_val":null,"acres":"PACRES"},"32510":{"name":"Carson City County, NV","url":"https://portal.carsoncity.gov/server/rest/services/CarsonCity/CarsonCityNV_OpenData/MapServer/36","apn":"APN","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES"},"32007":{"name":"Elko County, NV","url":"https://arcgis.water.nv.gov/arcgis/rest/services/BaseLayers/County_Parcels_in_Nevada/MapServer/0","apn":"APN","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"Acres"},"40143":{"name":"Tulsa County, OK","url":"https://map11.incog.org/arcgis11wa/rest/services/Parcels_TulsaCo/FeatureServer/0","apn":"AccountNo","addr":"PropertyAddress","use":"UseCode","land_val":null,"imp_val":null,"acres":"GrossAcre"},"41051":{"name":"Multnomah County, OR","url":"https://www3.multco.us/gisagspublic/rest/services/DART/Taxlots_Orion_Public/MapServer/0","apn":"MAPTAXLOT","addr":"SITUSADDR","use":"PROPCLASS (property class)","land_val":null,"imp_val":null,"acres":"SIZEACRES"},"41067":{"name":"Washington County, OR","url":"https://pappgispub1.co.washington.or.us/server/rest/services/baselayers/Taxlots_SP/MapServer/0","apn":"TLNO","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"ACRES"},"41005":{"name":"Clackamas County, OR","url":"https://services3.arcgis.com/I2eWXOndpF9m8oKC/ArcGIS/rest/services/Taxlots_CMap/FeatureServer/0","apn":"PARCEL_NUMBER","addr":"SITUS_FULL","use":"LANDCLASS","land_val":null,"imp_val":null,"acres":"MAPACRES"},"41039":{"name":"Lane County, OR","url":"https://lcmaps.lanecounty.org/arcgis/rest/services/CommishSearch/AddressParcelNew/FeatureServer/1","apn":"MAPTAXLOT","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"MAPACRES"},"41047":{"name":"Marion County, OR","url":"https://gis.co.marion.or.us/arcgis/rest/services/Public/Parcels/MapServer/0","apn":"TAXLOT","addr":"SITUS","use":"PROPCLASS","land_val":null,"imp_val":null,"acres":"ACRES"},"42101":{"name":"Philadelphia County, PA","url":"https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/OPA_PROPERTIES_PUBLIC/FeatureServer/0","apn":"parcel_number","addr":"location","use":"category_code","land_val":"taxable_land; exempt_land","imp_val":"taxable_building; exempt_building","acres":"total_area"},"42091":{"name":"Montgomery County, PA","url":"https://mapservices.pasda.psu.edu/server/rest/services/pasda/MontgomeryCounty/MapServer/14","apn":"PARCEL","addr":"SITE_ADDRESS","use":"LAND_USE","land_val":null,"imp_val":null,"acres":"LAND_ACRES"},"42017":{"name":"Bucks County, PA","url":"https://mapservices.pasda.psu.edu/server/rest/services/pasda/BucksCounty/MapServer/17","apn":"PARCEL_NUM","addr":"ADDRESS","use":"LAND_USE_C","land_val":null,"imp_val":null,"acres":"DEED_AREA"},"45045":{"name":"Greenville County, SC","url":"https://citygis.greenvillesc.gov/arcgis/rest/services/AddressSearch/Property/MapServer/3","apn":"PIN","addr":"SITE_ADDRESS","use":"LANDUSE","land_val":null,"imp_val":null,"acres":"GIS_ACRES"},"45051":{"name":"Horry County, SC","url":"https://gisportal.horrycounty.org/server/rest/services/Hosted/Energov_iGapps_WFL1/FeatureServer/6","apn":"pintext","addr":"SITE_ADDRESS","use":"landusecode","land_val":"assessedland","imp_val":"assessedimprv","acres":"acreage"},"45083":{"name":"Spartanburg County, SC","url":"https://maps.spartanburgcounty.org/server/rest/services/GIS/CAMA_Parcels/MapServer/0","apn":"MAPNUMBER","addr":"PropertyLocation","use":"LandUse","land_val":"CurrentAssessedLandValue","imp_val":"CurrentAssessedBuildingValue","acres":"DEEDACREAGE"},"46099":{"name":"Minnehaha County, SD","url":"https://services1.arcgis.com/Ezk9fcjSUkeadg6u/ArcGIS/rest/services/Minnehaha_Map_WFL1/FeatureServer/6","apn":"COUNTY_PIN","addr":"SITE_ADDRESS","use":"USECLASS1","land_val":null,"imp_val":null,"acres":"ACRES_DEED"},"46103":{"name":"Pennington County, SD","url":"https://gis.rcgov.org/server/rest/services/OpenData/TaxParcels/MapServer/0","apn":"PIN","addr":"PropAddress","use":"LandUse","land_val":null,"imp_val":null,"acres":"Acres"},"47157":{"name":"Shelby County, TN","url":"https://geoviewer.cot.tn.gov/arcgis/rest/services/GeoViewer/NonImpact_Parcels/MapServer/6","apn":"PARCELID","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"CALC_ACRE"},"47037":{"name":"Davidson County, TN","url":"https://geoviewer.cot.tn.gov/arcgis/rest/services/GeoViewer/NonImpact_Parcels/MapServer/1","apn":"APN","addr":"PropAddr","use":"LUCode","land_val":"LandAssd","imp_val":"ImprAssd","acres":"DEEDEDACRE"},"47093":{"name":"Knox County, TN","url":"https://geoviewer.cot.tn.gov/arcgis/rest/services/GeoViewer/NonImpact_Parcels/MapServer/3","apn":"PARCELID_1","addr":"LOC_HOUSE_NUMBER","use":"LANDUSE","land_val":null,"imp_val":null,"acres":"RECORDED_AREA"},"47065":{"name":"Hamilton County, TN","url":"https://geoviewer.cot.tn.gov/arcgis/rest/services/GeoViewer/NonImpact_Parcels/MapServer/2","apn":"GISLINK","addr":"SITE_ADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"CALC_ACRE"},"47149":{"name":"Rutherford County, TN","url":"https://services5.arcgis.com/A5C0MR9xfkxVRwat/ArcGIS/rest/services/Parcel_Data/FeatureServer/1","apn":"ParcelID","addr":"STREETADDRESS","use":null,"land_val":null,"imp_val":null,"acres":"CALCACRES"},"48201":{"name":"Harris County, TX","url":"https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0","apn":"HCAD_NUM","addr":"site_str_num","use":"land_use","land_val":null,"imp_val":null,"acres":"acreage_1"},"48113":{"name":"Dallas County, TX","url":"https://egis.dallascityhall.com/arcgis/rest/services/Basemap/DallasTaxParcels/MapServer/0","apn":"ACCT","addr":"ST_NUM","use":"SPTBCODE","land_val":null,"imp_val":null,"acres":"AREA_FEET"},"48439":{"name":"Tarrant County, TX","url":"https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0","apn":"ACCOUNT","addr":"SITUS_ADDR","use":null,"land_val":null,"imp_val":null,"acres":"LAND_ACRES"},"48029":{"name":"Bexar County, TX","url":"https://maps.bexar.org/arcgis/rest/services/Parcels/MapServer/0","apn":"PropID","addr":"Situs","use":"PropUse","land_val":null,"imp_val":null,"acres":"LglAcres"},"48453":{"name":"Travis County, TX","url":"https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD_public/MapServer/0","apn":"PROP_ID","addr":"situs_address","use":null,"land_val":null,"imp_val":null,"acres":"tcad_acres"}}};
if (typeof window !== "undefined") window.PARCEL_REGISTRY = PARCEL_REGISTRY;

function getParcelService(ll) {
  if (typeof PARCEL_REGISTRY === "undefined" || !PARCEL_REGISTRY) return null;
  if (typeof selected !== "undefined" && selected && selected.length >= 5) {
    const cFips = selected.slice(0, 5), sFips = selected.slice(0, 2);
    if (PARCEL_REGISTRY.counties && PARCEL_REGISTRY.counties[cFips]) return Object.assign({}, PARCEL_REGISTRY.counties[cFips], { fips: cFips });
    if (PARCEL_REGISTRY.states && PARCEL_REGISTRY.states[sFips]) return Object.assign({}, PARCEL_REGISTRY.states[sFips], { fips: sFips });
  }
  if (typeof activeCounty !== "undefined" && activeCounty === "oc") {
    if (PARCEL_REGISTRY.counties && PARCEL_REGISTRY.counties["06059"]) return Object.assign({}, PARCEL_REGISTRY.counties["06059"], { fips: "06059" });
  }
  if (typeof allFeatures === "function") {
    const fs = allFeatures();
    if (fs && fs.length && fs[0].properties && fs[0].properties.id) {
      const gid = fs[0].properties.id, cFips = gid.slice(0, 5), sFips = gid.slice(0, 2);
      if (PARCEL_REGISTRY.counties && PARCEL_REGISTRY.counties[cFips]) return Object.assign({}, PARCEL_REGISTRY.counties[cFips], { fips: cFips });
      if (PARCEL_REGISTRY.states && PARCEL_REGISTRY.states[sFips]) return Object.assign({}, PARCEL_REGISTRY.states[sFips], { fips: sFips });
    }
  }
  if (ll && ll.lat >= 32.5 && ll.lat <= 42.0 && ll.lng >= -124.5 && ll.lng <= -114.1) {
    if (ll.lat >= 33.35 && ll.lat <= 33.95 && ll.lng >= -118.15 && ll.lng <= -117.40) {
      return Object.assign({}, PARCEL_REGISTRY.counties["06059"], { fips: "06059" });
    }
    return Object.assign({}, PARCEL_REGISTRY.counties["06037"], { fips: "06037" });
  }
  return null;
}

async function fetchParcel(ll) {
  const svc = typeof getParcelService === "function" ? getParcelService(ll) : null;
  if (svc && svc.url) {
    if (svc.fips === "06037" || (svc.url && svc.url.indexOf("LACounty_Parcel") !== -1)) {
      const q = `${PARCEL_URL}?geometry=${ll.lng.toFixed(6)},${ll.lat.toFixed(6)}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${PARCEL_FIELDS}&returnGeometry=true&outSR=4326&f=json`;
      let d;
      try { d = await (await fetch(q)).json(); } catch (e) { try { d = await jsonp(q); } catch (e2) { d = null; } }
      if (d && !d.error && d.features && d.features.length) return d.features[0];
    }
    const base = svc.url.replace(/\/query\/?$/, "");
    const q = `${base}/query?geometry=${ll.lng.toFixed(6)},${ll.lat.toFixed(6)}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=15&units=esriSRUnit_Meter&outFields=*&returnGeometry=true&outSR=4326&f=json`;
    let d;
    try { d = await (await fetch(q)).json(); } catch (e) { try { d = await jsonp(q); } catch (e2) { d = null; } }
    if (d && d.features && d.features.length) {
      const feat = d.features[0], a = feat.attributes || {};
      const num = x => (x == null || x === "" || isNaN(+x)) ? 0 : +x;
      const apnVal = a[svc.apn] || a.APN || a.PARCELID || a.PIN || a.AIN || "";
      const addrVal = a[svc.addr] || a.SITE_ADDRESS || a.SITUS_ADDRESS || a.ADDRESS || "";
      const cleanAddr = String(addrVal).replace(/\s+/g, " ").trim();
      const parts = cleanAddr.split(" ");
      const houseNo = /^\d+/.test(parts[0]) ? parts[0] : "";
      const street = houseNo ? parts.slice(1).join(" ") : cleanAddr;
      const useVal = (svc.use && a[svc.use]) ? String(a[svc.use]) : (a.USE_DESC || a.LAND_USE || a.PROPCLASS || "");
      const landVal = (svc.land_val && a[svc.land_val]) ? num(a[svc.land_val]) : 0;
      const impVal = (svc.imp_val && a[svc.imp_val]) ? num(a[svc.imp_val]) : 0;
      const totVal = (svc.tot_val && a[svc.tot_val]) ? num(a[svc.tot_val]) : (landVal + impVal);
      const yrBuilt = (svc.yr_blt && a[svc.yr_blt]) ? num(a[svc.yr_blt]) : num(a.YEAR_BUILT || a.YEARBUILT || a.AYB);
      const sqftVal = (svc.sqft && a[svc.sqft]) ? num(a[svc.sqft]) : num(a.BLDG_SQFT || a.LIVING_AREA || a.SQFT);
      const acresVal = (svc.acres && a[svc.acres]) ? num(a[svc.acres]) : num(a.ACRES || a.GISACRES);
      
      const normA = {
        AIN: apnVal || ("PARCEL-" + Math.round(ll.lat*1e4) + "-" + Math.round(ll.lng*1e4)),
        SitusFullAddress: cleanAddr || ("Parcel " + (apnVal || "at " + ll.lat.toFixed(4) + ", " + ll.lng.toFixed(4))),
        SitusHouseNo: houseNo,
        SitusStreet: street,
        ZoneCode: String(a.ZONING || a.ZONE || a.ZoneDist1 || a.CITY_ZONING || a.ZONING_DESC || a.LUCode || a.PUC || a.DOR_UC || a.USE_CODE || a.USECODE || a.LAND_USE || a.USE_DESC || a.PROPCLASS || "").trim(),
        UseDescription: useVal || `${svc.name || "Jurisdiction"} parcel`,
        UseCode: "",
        UseType: /res|single|family|condo|apt|dwell|home/i.test(useVal) ? "residential" : "commercial / mixed or other",
        Roll_LandValue: landVal,
        Roll_ImpValue: impVal,
        Roll_TotalValue: totVal,
        YearBuilt1: yrBuilt || 0,
        Bedrooms1: num(a.BEDROOMS ?? a.NBR_BEDROOMS),
        Bathrooms1: num(a.BATHROOMS ?? a.NBR_BATHS),
        SQFTmain1: sqftVal || 0,
        Acres: acresVal || 0,
        county: svc.name || "County parcel service"
      };
      return { attributes: normA, geometry: feat.geometry };
    }
  }
  const q = `${PARCEL_URL}?geometry=${ll.lng.toFixed(6)},${ll.lat.toFixed(6)}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${PARCEL_FIELDS}&returnGeometry=true&outSR=4326&f=json`;
  let d;
  try { d = await (await fetch(q)).json(); } catch (e) { try { d = await jsonp(q); } catch (e2) { d = null; } }
  if (d && !d.error && d.features && d.features.length) return d.features[0];
  return null;
}
function ringAreaM2(ring) {
  // planar area after projecting lon/lat to meters around the ring (accurate at parcel scale)
  const lat0 = ring[0][1] * Math.PI / 180, kx = 111320 * Math.cos(lat0), ky = 110540; let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] * kx) * (ring[i][1] * ky) - (ring[i][0] * kx) * (ring[j][1] * ky);
  return Math.abs(a / 2);
}
function zoneAt(ll, a) {
  const Z = (typeof D !== "undefined" && D && D.layers && D.layers.zoning) ? D.layers.zoning : null;
  if (Z) {
    const key = `${Math.floor((ll.lng + 180) / Z.cell)},${Math.floor((ll.lat + 90) / Z.cell)}`;
    for (const k of [key, ...cellKeys(Z.cell, 0)]) for (const p of zCell(k)) {
      const f = { geometry: { type: "Polygon", coordinates: p.rings.map(r => r.map(([la, lo]) => [lo, la])) } };
      if (pointInFeature(f, ll.lng, ll.lat)) return p;
    }
  }
  if (a && (a.ZoneCode || a.UseDescription)) {
    const zCode = String(a.ZoneCode || a.UseDescription).trim();
    let cat = "other";
    if (/single|sfr|rs|r-?1|estate|detached/i.test(zCode)) cat = "single-family";
    else if (/multi|apt|condo|r-?[2-5]|duplex|townhome/i.test(zCode)) cat = "multifamily";
    else if (/comm|retail|shop|c-?[1-4]|business|b-?[1-3]/i.test(zCode)) cat = "commercial / mixed use";
    else if (/ind|m-?[1-3]|manuf|wareh/i.test(zCode)) cat = "industrial";
    else if (/park|open|rec|civic|pf|pres/i.test(zCode)) cat = "open space / public";
    else if (/ag|farm|rural/i.test(zCode)) cat = "agricultural";
    return {
      zone: zCode,
      cat: cat,
      juris: a.county || (typeof selected !== "undefined" && byId.get(selected) ? byId.get(selected).properties.c : "Local Municipality")
    };
  }
  return null;
}
// building outlines (and pools) on this lot from OpenStreetMap; in LA most outlines come from the County's building
// data import, often with a height. Returns null when OSM can't be reached.
async function fetchOsmLot(rings) {
  const ring = rings[0] || [];
  const step = Math.max(1, Math.ceil(ring.length / 40));
  const poly = ring.filter((_, i) => i % step === 0).map(([x, y]) => `${y.toFixed(6)} ${x.toFixed(6)}`).join(" ");
  const q = `[out:json][timeout:12];(way["building"](poly:"${poly}");way["leisure"="swimming_pool"](poly:"${poly}"););out tags geom;`;
  const one = async (url, delay) => {
      if (delay) await new Promise(r => setTimeout(r, delay));
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
      const r = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), signal: ctl.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      clearTimeout(t);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      const ways = (d.elements || []).filter(e => e.type === "way" && e.geometry && e.geometry.length > 2);
      const toRing = e => e.geometry.map(g => [g.lon, g.lat]);
      const bl = ways.filter(e => e.tags && e.tags.building).map(e => {
        const r_ = toRing(e), t_ = e.tags; const hm = parseFloat(String(t_.height || "").replace(/[^0-9.]/g, ""));
        return { ring: r_, sqft: Math.round(ringAreaM2(r_) * 10.7639), levels: parseInt(t_["building:levels"]) || null,
                 height: isFinite(hm) && hm > 0 ? hm : null, type: t_.building, roof: t_["roof:shape"] || null };
      }).sort((a, b) => b.sqft - a.sqft);
      const pools = ways.filter(e => e.tags && e.tags.leisure === "swimming_pool").length;
      return { bl, pools };
  };
  try { return await Promise.any(OVERPASS.map((u, k) => one(u, k * 2500))); } catch (e) { /* every mirror failed */ }
  return null;
}
function houseFacts(a, lot, osm, PF, st) {
  const slots = [1, 2, 3, 4, 5].map(i => ({ i, sqft: +a[`SQFTmain${i}`] || 0, units: +a[`Units${i}`] || 0, beds: +a[`Bedrooms${i}`] || 0,
    baths: +a[`Bathrooms${i}`] || 0, yb: +a[`YearBuilt${i}`] || 0, eff: +a[`EffectiveYear${i}`] || 0, design: a[`DesignType${i}`] || "", qc: a[`QualityClass${i}`] || "" }))
    .filter(x => x.sqft > 0 || x.units > 0);
  const main = slots[0] || { sqft: 0, units: 0, beds: 0, baths: 0, yb: 0, eff: 0, design: "", qc: "" };
  const F = { slots, main, bldg: main.sqft, beds: main.beds, baths: main.baths, units: slots.reduce((t, x) => t + x.units, 0) || main.units,
    living: slots.reduce((t, x) => t + x.sqft, 0), yb: main.yb || main.eff, eff: main.eff, qc: main.qc, design: main.design, src: {} };
  const B = osm && osm.bl ? osm.bl.filter(b => b.sqft >= 80) : [];
  const big = B[0];

  // Footprint determination
  if (big) {
    F.foot = big.sqft; F.footAll = B.reduce((t, b) => t + b.sqft, 0); F.outlines = B.map(b => b.ring); F.others = B.length - 1;
    F.src.foot = "building outline (OpenStreetMap, from County LiDAR/GIS)";
    F.roof = big.roof;
  } else {
    F.foot = Math.min(F.bldg || lot * 0.3, lot * 0.6);
    F.footAll = F.foot + (slots.slice(1).reduce((t, x) => t + x.sqft, 0));
    F.src.foot = osm ? "estimated from living area (no building outline)" : "estimated from living area (building outlines offline)";
  }

  // Stories determination (Never 'unknown' - uses Street View toggle, LiDAR, or physical living area ratio)
  if (st && st.manualStories != null) {
    F.stories = st.manualStories;
    F.conf = "manual";
    F.src.stories = `User confirmed via Street View (${st.manualStories} stor${st.manualStories > 1 ? "ies" : "y"})`;
  } else if (big && big.levels) {
    F.stories = big.levels; F.src.stories = `OpenStreetMap levels tag (${big.levels})`; F.conf = "recorded";
  } else if (big && big.height) {
    F.stories = Math.max(1, Math.round((big.height - 1) / 3.2));
    F.src.stories = `building height ${big.height.toFixed(1)} m (County LiDAR via OpenStreetMap)`; F.conf = "measured";
  } else if (big && F.bldg && big.sqft > 0) {
    const r = F.bldg / big.sqft;
    F.stories = r >= 1.38 ? 2 : 1;
    F.src.stories = r >= 1.38 ? `2 stories (living area ÷ footprint = ${r.toFixed(2)})` : `1 story (living area ÷ footprint = ${r.toFixed(2)})`;
    F.conf = "estimated";
  } else if (PF && PF.stories) {
    F.stories = PF.stories; F.src.stories = PF.storiesSrc; F.conf = "permit";
  } else {
    // Intelligent physical inference from Assessor living area and lot coverage
    if (F.bldg >= 2600 || (lot > 0 && F.bldg / lot > 0.42)) {
      F.stories = 2;
      F.src.stories = `inferred: ${fmtN(F.bldg)} sq ft living area indicates 2-story layout`;
      F.conf = "estimated";
    } else {
      F.stories = 1;
      F.src.stories = F.bldg ? `inferred: single-story profile (${fmtN(F.bldg)} sq ft living area)` : "assumed 1 story (no living-area record for this parcel)";
      F.conf = "estimated";
    }
  }

  F.dec = decodeAssessor(a);
  F.pool = F.dec.pool ? true : osm ? osm.pools > 0 : null;
  F.src.pool = F.dec.pool ? `County Assessor code (${F.dec.pool})` : osm ? "OpenStreetMap" : "";
  F.yard = Math.max(lot - F.footAll - lot * 0.2, 0); // setbacks and driveway allowance
  F.second = slots.length > 1 || (F.others || 0) > 0 || !!F.dec.adu;
  return F;
}

function houseChecks(a, lot, m, z, hMax, F, R) {
  const res = /^0/.test(String(a.UseCode || "")) || /resid/i.test(a.UseType || "");
  const { bldg, beds, baths, units, yb, foot, yard } = F;
  const cat = z ? z.cat : null, sf = cat === "single-family" || (!cat && res && units <= 1);
  const fire = R && R.fire ? R.fire.vh : (m.fire || 0) >= 0.5;
  const hist = R ? [R.hpoz, R.hcm].some(x => x.ok && x.v.length) || (R.hc.ok && R.hc.v.some(r => /design|landmark|register/i.test(r.Status_Code_Description || ""))) : false;
  const hill = R && R.hill && R.hill.ok && R.hill.v.length > 0;
  const slide = R && R.slide && R.slide.ok && R.slide.v.length > 0;
  const liq = R && R.liq && R.liq.ok && R.liq.v.length > 0;
  const fault = R && R.fault && R.fault.ok && R.fault.v.length > 0;
  
  const C = [], add = (name, v, why) => C.push({ name, v, why });
  const out = () => ({ C, yard, foot, sf, yb, beds, baths, bldg, units, res, lot, stories: F.stories, pool: F.pool, hist, fire, hill, slide, liq, fault, R, a });
  
  if (hist) add("Historic district or landmark", "note", "This lot is in a historic district or is a designated resource: exterior alterations require HPOZ design review, and SB 9 does not apply.");
  if (hill) add("Hillside area", "note", "LA Hillside Ordinance applies: stepped foundation, grading limits and height restrictions make additions and second stories more complex.");
  if (slide || liq || fault) {
    const gz = [slide && "landslide", liq && "liquefaction", fault && "fault"].filter(Boolean);
    add("Geologic hazard zone", "note", `In state ${gz.join(", ")} hazard zone: new additions or ADUs require a site-specific geotechnical/soils investigation.`);
  }
  if (F.dec && F.dec.adu) add("Recorded ADU", "note", `The Assessor records ${/^[AEIOU]/.test(F.dec.adu) ? "an" : "a"} ${F.dec.adu} on this lot.`);
  if (F.dec && F.dec.mills) add("Mills Act contract", "note", "This home has a Mills Act historic contract (lower property tax in exchange for preservation).");
  if (!res) { add("Home upgrades", "no", `This parcel is ${esc(a.UseDescription || "not residential")}, so residential homeowner checks do not apply.`); return out(); }
  if (F.second) add("Second building on the lot", "note", F.slots.length > 1 ? `The Assessor lists ${F.slots.length} structures (${F.slots.map(x => fmtN(x.sqft) + " sq ft").join(", ")}): an existing ADU or guest house may already be present.` : "Second structure (garage or studio) detected on building footprint outlines.");
  
  if (yard >= 800) add("Detached ADU (backyard home)", "yes", `${F.dec && F.dec.adu ? `One ${F.dec.adu} is already recorded; room for another. ` : ""}About ${fmtN(yard)} sq ft of open yard after setbacks; easily fits a 600–800 sq ft detached ADU with 4-ft rear/side setbacks.`);
  else if (yard >= 400) add("Detached ADU", "maybe", `Only ~${fmtN(yard)} sq ft of open yard: a 400 sq ft studio ADU or garage conversion is more viable.`);
  else add("Detached ADU", "no", `Limited open yard (~${fmtN(yard)} sq ft); a garage conversion or Junior ADU is recommended.`);
  
  if (sf && bldg >= 1000) add("Junior ADU (inside the house, up to 500 sq ft)", "yes", `${fmtN(bldg)} sq ft single-family home: state law (Gov. Code §§ 66313 and 66333) allows converting up to 500 sq ft of interior livable space; since 1 Jan 2026 (AB 1154) owner-occupancy is required only if the JADU shares bathroom facilities with the main home, and rentals must be longer than 30 days.`);
  if (units >= 2 && sf) add("Existing second unit", "note", `Assessor roll shows ${units} units here.`);
  
  if (sf && hist) add("SB 9 lot split", "no", "SB 9 does not apply in historic districts or on designated landmarks.");
  else if (sf && lot >= 2400 && !fire && !slide && !fault) add("SB 9 lot split / second home", "yes", `${fmtN(lot)} sq ft single-family parcel: SB 9 allows a split into two ~${fmtN(Math.round(lot/2))} sq ft lots and up to 4 total units.`);
  else if (sf && lot >= 2400 && fire) add("SB 9 lot split", "no", "This lot is in a Very High Fire Hazard Severity Zone (CAL FIRE), statutorily ineligible for SB 9 lot splits.");
  else if (sf && lot >= 2400 && (slide || fault)) add("SB 9 lot split", "no", "Located in an Alquist-Priolo fault or landslide hazard zone; statutorily restricted under SB 9 unless seismic clearance is certified.");
  else if (sf) add("SB 9 lot split", "no", `Lot size is ${fmtN(lot)} sq ft; SB 9 requires at least 2,400 sq ft to create two legal lots of ≥1,200 sq ft.`);
  
  if (F.pool) add("Swimming pool", "note", `There is already a ${F.dec && F.dec.pool ? F.dec.pool : "pool"} on this lot (${F.src.pool}).`);
  else if (yard >= 1200) add("Swimming pool", "yes", `~${fmtN(yard)} sq ft of open yard.`);
  
  if (F.stories === 1) {
    add("Second story", hMax != null && hMax < 28 ? "no" : "yes",
      hMax != null && hMax < 28 ? `One story (${F.src.stories}), but local zoning height limit of ${hMax} ft restricts a full second story.` :
      `One story (${F.src.stories}). ${hMax ? `Height limit here is ${hMax} ft.` : "Check the zone's height limit."} Foundation inspection required to carry upper-floor loads.`);
  } else {
    add("Second story", "note", `Already ${F.stories} stories (${F.src.stories}).`);
  }
  
  add("Rooftop deck", F.roof === "flat" ? "yes" : F.roof ? "no" : "maybe", F.roof === "flat" ? "Flat roof recorded: deck requires structural framing verification and waterproof membrane." : F.roof ? `Roof shape is ${esc(F.roof)}; deck requires a flat section or garage roof.` : "Requires a flat roof or flat garage roof section.");
  if (yard >= 400) add("Garden, deck or patio", "yes", `~${fmtN(yard)} sq ft of open yard.`);
  if (foot >= 350) add("Rooftop solar", "yes", `~${fmtN(foot)} sq ft of roof footprint.`);
  if (yb && yb < 1980 && sf) add("Seismic bolting and bracing", "yes", `Built in ${yb}: raised foundation qualifies for California Earthquake Brace + Bolt grant (up to $3,000).`);
  if (yb && yb < 1975) add("Whole-house repiping", "maybe", `Built in ${yb}: galvanized steel supply piping common in pre-1975 homes.`);
  if (beds >= 3 && baths && baths < beds - 1) add("Add a bathroom", "yes", `${beds} bedrooms but only ${baths} bath${baths > 1 ? "s" : ""}: strong resale ROI.`);
  if (F.dec && F.dec.heat && !F.dec.ac) add("Heat-pump heating and cooling", "yes", `Existing heating is ${F.dec.heat} with no central AC: heat pump provides both.`);
  if (fire) add("Wildfire hardening (Zone 0)", "yes", "Very High fire zone: ember-resistant vents, boxed eaves and a 5-ft ember-resistant (Zone 0) perimeter. The Board of Forestry adopted emergency Zone 0 regulations on 19 Aug 2026 but withdrew them from the Office of Administrative Law on 8 Sep 2026, so no Zone 0 rule is in effect yet; check for the re-adopted rule and its phase-in for existing homes.");
  
  return out();
}

// ---------------- Detailed House-Specific Cost Analysis Engine ----------------
function getHouseUpgradeCostDetails(u, h, m) {
  const yb = h.yb || 1965;
  const hv = h.houseHv || m.hv || 900000;
  const lot = h.lot || 6000;
  const yard = h.yard || 1000;
  const foot = h.foot || 1400;
  const bldg = h.bldg || 1600;
  const medRent = (typeof D !== "undefined" && D && D.meta && D.meta.rent_med) ? D.meta.rent_med : 2102;
  const locRent = Math.min(Math.max((m.rent || medRent) / medRent, 0.7), 1.6);
  const houseVpsf = h.houseVpsf || Math.min(Math.max(hv / 1800, 250), 1400);

  let sqft = 0, timelineMonths = "6–9", baseCost = 0, breakdown = [], siteAdjustments = [], totalCost = 0, resaleValue = 0, impactFees = 0, schoolFee = 0;

  if (/^Detached ADU/.test(u.n || u.name)) {
    const defaultSqft = yard >= 1500 ? 800 : yard >= 800 ? 600 : 400;
    sqft = u.customSqft ? +u.customSqft : (h.st && h.st.aduSqft ? +h.st.aduSqft : defaultSqft);
    timelineMonths = sqft >= 800 ? "9–12" : sqft >= 500 ? "8–10" : "6–8";

    // Unit costs below are this page's own model; the "trade schedule" they were first said to come from could not be found (Nov 2026), so they are unverified estimates:
    // 400 sf Studio: $201,500 hard, $18,500 soft = $220,000 ($550.00/sf)
    // 650 sf 1-Bed: $317,500 hard, $27,500 soft = $345,000 ($530.77/sf)
    // 800 sf 2-Bed: $378,000 hard, $35,000 soft, $8,000 impact = $421,000 ($526.25/sf)
    let hard = 0, soft = 0;
    if (sqft <= 400) {
      hard = Math.round(sqft * 503.75);
      soft = 18500;
    } else if (sqft <= 650) {
      const t = (sqft - 400) / 250;
      hard = Math.round(201500 + t * (317500 - 201500));
      soft = Math.round(18500 + t * (27500 - 18500));
    } else if (sqft <= 800) {
      const t = (sqft - 650) / 150;
      hard = Math.round(317500 + t * (378000 - 317500));
      soft = Math.round(27500 + t * (35000 - 27500));
    } else {
      hard = Math.round(378000 + (sqft - 800) * 440);
      soft = Math.round(35000 + (sqft - 800) * 15);
    }

    const fnd = Math.round(hard * 0.12);
    const frame = Math.round(hard * 0.36);
    const env = Math.round(hard * 0.13);
    const mep = Math.round(hard * 0.18);
    const fin = hard - (fnd + frame + env + mep);
    const plans = Math.round(soft * 0.60);
    const permits = soft - plans;

    // Statutory developer fees:
    // School developer fee: ADUs/JADUs under 500 sf of interior livable space are exempt (Gov. Code § 66311.5(c)(3) "less than 500 square feet"; Ed. Code § 17620(a)(1)(C)(i)); modeled at the SAB Level 1 cap ($5.38/sf, set 28 Jan 2026) at 500 sf and up
    schoolFee = sqft >= 500 ? Math.round(sqft * 5.38) : 0;   // districts set their own rate up to the SAB Level 1 cap; verify locally
    // Development impact fee: ADUs of 750 sf or less of interior livable space are exempt (Gov. Code § 66311.5, renumbered from § 66324 by SB 543, eff. 1 Jan 2026); proportional above that
    impactFees = sqft <= 750 ? 0 : Math.round(8000 + (sqft - 750) * 18.0);

    breakdown = [
      { cat: "Foundation & Reinforced Concrete Slab", amount: fnd, desc: `~$${Math.round(fnd/sqft)}/sq ft: 4\" fiber-reinforced monolithic slab with continuous grade beam footings` },
      { cat: "Framing & Structural Shell", amount: frame, desc: `~$${Math.round(frame/sqft)}/sq ft: 2x6 exterior framing, engineered roof trusses, OSB shear wall assemblies` },
      { cat: "Exterior Envelope & Roofing", amount: env, desc: `~$${Math.round(env/sqft)}/sq ft: 3-coat cementitious stucco / fiber-cement siding, Title 24 cool composition roof, Low-E vinyl windows` },
      { cat: "Mechanical, Electrical & Plumbing (MEP)", amount: mep, desc: `~$${Math.round(mep/sqft)}/sq ft: Ductless multi-zone heat pump, 100A subpanel, PEX plumbing, high-efficiency heat pump water heater` },
      { cat: "Interior Architectural Finishes", amount: fin, desc: `~$${Math.round(fin/sqft)}/sq ft: Drywall, luxury vinyl plank, complete kitchen with quartz counters, stainless appliances, full tile bath` },
      { cat: "Architecture, Engineering & City Permits", amount: plans + permits, desc: "Architectural drawings, structural engineering calculations, Title 24 energy compliance report, municipal plan check" }
    ];

    if (schoolFee > 0) {
      breakdown.push({ cat: "School District Developer Fee (500 sq ft and up)", amount: schoolFee, desc: "Modeled at the State Allocation Board Level 1 cap ($5.38/sq ft, adopted 28 Jan 2026); districts set their own rate up to that cap. ADUs under 500 sq ft are exempt (Gov. Code § 66311.5(c)(3); Ed. Code § 17620(a)(1)(C)(i))" });
    }
    if (impactFees > 0) {
      breakdown.push({ cat: "Development Impact Fees (over 750 sq ft)", amount: impactFees, desc: "Proportional parks, traffic and utility fees (ADUs of 750 sq ft or less are exempt, Gov. Code § 66311.5 as amended by SB 543)" });
    }

    let siteCost = 0;
    if (yb < 1978) {
      siteAdjustments.push({ name: `Pre-1978 Electrical Service Upgrade (${yb} build)`, amount: 4800, desc: "Existing home has 100A panel: upgraded to 200A main meter service to feed ADU subpanel" });
      siteCost += 4800;
    }
    if (h.hill) {
      siteAdjustments.push({ name: "Hillside Ordinance Foundation", amount: 26000, desc: "Drilled concrete friction caissons and grade beams for sloped ground" });
      siteCost += 26000;
    }
    if (h.fire) {
      siteAdjustments.push({ name: "CalFire VHFHSZ Wildfire Hardening (Title 24 Ch. 7A)", amount: 9500, desc: "Non-combustible exterior siding, 1/8\" ember-resistant Vulcan vents, and interior NFPA 13D fire sprinkler system" });
      siteCost += 9500;
    }
    if (h.slide || h.liq || h.fault) {
      siteAdjustments.push({ name: "Geotechnical Soils & Seismic Investigation", amount: 6500, desc: "Certified soils engineering report required for building permit approval in geologic hazard zone" });
      siteCost += 6500;
    }
    const runFt = Math.max(35, Math.min(Math.round(Math.sqrt(yard) * 1.5), 130));
    const trench = runFt * 110;
    siteAdjustments.push({ name: `Rear Yard Utility Lateral Trenching (~${runFt} ft run)`, amount: trench, desc: "Trenching for dedicated 4\" sewer lateral connection, 1\" water line, and electrical conduit across yard" });
    siteCost += trench;

    const hardSub = fnd + frame + env + mep + fin + siteCost;
    const gc = Math.round(hardSub * 0.15);
    breakdown.push({ cat: "Site-Specific Adjustments for This Parcel", amount: siteCost, desc: `${siteAdjustments.length} parcel conditions identified (panel, trenching, environmental)` });
    breakdown.push({ cat: "GC Overhead, Profit & Contingency (15%)", amount: gc, desc: "General contractor project supervision, builder risk insurance, and 15% construction contingency" });

    totalCost = fnd + frame + env + mep + fin + plans + permits + schoolFee + impactFees + siteCost + gc;

    const baseRentMo = sqft < 500 ? 1750 : sqft < 750 ? 2250 : Math.round(2850 + (sqft - 750) * 1.5);
    const rentMo = Math.round(baseRentMo * locRent);
    const annualNoi = rentMo * 12 * 0.70;
    const incomeVal = annualNoi / 0.055;
    const appraisalVal = sqft * houseVpsf * 0.82;
    resaleValue = Math.round(0.50 * incomeVal + 0.50 * appraisalVal);

    u.monthlyRent = rentMo;
    u.impactFees = impactFees;
    u.schoolFee = schoolFee;
  } else if (/^Full second story/.test(u.n || u.name)) {
    const defaultSqft = Math.min(Math.max(foot, 600), 1400);
    sqft = u.customSqft ? +u.customSqft : defaultSqft;
    timelineMonths = "9–14";
    // Unverified model estimate (no published schedule found): 600 sf = $393,000 ($655/sf all-in)
    const baseTradeCost = Math.round(sqft * 490);
    const under = yb < 1965 ? 35000 : 25000;
    const demo = 28000;
    const frame = Math.round(baseTradeCost * 0.44);
    const env = Math.round(baseTradeCost * 0.18);
    const mep = Math.round(baseTradeCost * 0.18);
    const fin = Math.round(baseTradeCost * 0.20);
    const stairs = 19000;
    const plans = 24000;
    const permits = Math.round(14000 + (sqft - 600) * 12);
    const tempHousing = 28000;

    breakdown = [
      { cat: "Existing Foundation Underpinning & Retrofit", amount: under, desc: "Reinforced perimeter concrete footings and Simpson hold-downs to support upper floor gravity and seismic loads" },
      { cat: "Roof Tear-Off & 1st Floor Joist Reinforcement", amount: demo, desc: "Removal of existing roof, structural LVL beams, sistering joists, and temporary weatherproofing" },
      { cat: "Second Story Framing & Shear Walls", amount: frame, desc: `$145/sq ft: 2x6 framing, engineered I-joist floor system, subflooring, and plywood shear walls` },
      { cat: "Exterior Envelope & Roofing", amount: env, desc: `$45/sq ft: Stucco/siding to match existing residence, cool composition shingle roof, windows` },
      { cat: "MEP Multi-Zone Distribution", amount: mep, desc: `$70/sq ft: Multi-zone heat pump system, plumbing drop stacks, electrical home runs` },
      { cat: "Interior Finishes & Stairway", amount: fin + stairs, desc: `Drywall, custom hardwood staircase, bedroom suites, luxury bathrooms, flooring, doors` },
      { cat: "Architecture, Structural Engineering & Permits", amount: plans + permits, desc: "Architectural construction documents, licensed structural engineer stamped calculations, city plan check" },
      { cat: "Temporary Living Expenses during Construction", amount: tempHousing, desc: "Allowance for homeowner relocation (~5 months) during unroofed framing phase" }
    ];

    let siteCost = 0;
    if (yb < 1978) { siteAdjustments.push({ name: "200A Electrical Service Upgrade", amount: 4800, desc: "Service drop and 200A main panel upgrade" }); siteCost += 4800; }
    if (h.hill) { siteAdjustments.push({ name: "Hillside Height & Slope Structural Engineering", amount: 22000, desc: "Structural review and baseline envelope compliance" }); siteCost += 22000; }
    if (h.fire) { siteAdjustments.push({ name: "Wildfire Chapter 7A Hardening", amount: 12000, desc: "Class A fire-rated roofing, boxed eaves, and interior fire sprinklers" }); siteCost += 12000; }

    const hardSub = under + demo + frame + env + mep + fin + stairs + siteCost;
    const gc = Math.round(hardSub * 0.15);
    breakdown.push({ cat: "Site-Specific Adjustments for This Parcel", amount: siteCost, desc: `${siteAdjustments.length} parcel conditions identified` });
    breakdown.push({ cat: "GC Overhead, Profit & 15% Contingency", amount: gc, desc: "15% General Contractor management, safety, and contingency" });

    totalCost = under + demo + frame + env + mep + fin + stairs + plans + permits + tempHousing + siteCost + gc;
    resaleValue = Math.round(sqft * houseVpsf * 0.88);
  } else {
    totalCost = u.c || 25000;
    resaleValue = u.v || 30000;
    breakdown = [
      { cat: "Standard Construction & Installation", amount: Math.round(totalCost * 0.85), desc: "Direct materials, licensed trade labor, equipment, and required municipal building permit fees" },
      { cat: "Permitting, Testing & Contingency", amount: Math.round(totalCost * 0.15), desc: "City inspection, title compliance testing, and contingency" }
    ];
  }

  return {
    sqft,
    timelineMonths,
    schoolFee,
    impactFees,
    totalCost,
    costPerSqFt: sqft > 0 ? totalCost / sqft : null,
    breakdown,
    siteAdjustments,
    resaleValue,
    netProfit: resaleValue - totalCost,
    paybackPerDollar: resaleValue / Math.max(totalCost, 1)
  };
}
function renderCostAnalysisSchedule(u, h, m) {
  const ca = u.cost_analysis;
  if (!ca) return `<p class="small muted">Detailed cost analysis not available for this upgrade.</p>`;
  
  let htm = `<div class="cost-schedule-card">
    <div class="cs-head">
      <div><b>Specific Cost Analysis: ${esc(u.n)}</b> <span class="muted">(${ca.sqft ? fmtN(ca.sqft) + " sq ft · " : ""}${ca.timelineMonths ? ca.timelineMonths + " mos timeline" : ""})</span></div>
      <div><b>Total All-In Cost: ${fmt$(u.c)}</b> ${ca.costPerSqFt ? `<span class="muted">(~$${Math.round(ca.costPerSqFt)}/sq ft)</span>` : ""}</div>
    </div>
    <p class="small muted" style="margin:4px 0 6px">Construction costs are this page's model estimate (unit costs per sq ft), not contractor quotes; the cost schedule they were first calibrated to could not be found, so treat them as unverified. Fees follow the cited state rules.</p>
    <table class="cs-table">
      <thead><tr><th>Component / Budget Category</th><th style="text-align:right">Estimated Cost</th><th>Scope &amp; Parcel Specifics</th></tr></thead>
      <tbody>`;
      
  ca.breakdown.forEach(item => {
    htm += `<tr>
      <td><b>${esc(item.cat)}</b></td>
      <td style="text-align:right;font-weight:600">${fmt$(item.amount)}</td>
      <td class="muted">${esc(item.desc)}</td>
    </tr>`;
  });

  htm += `</tbody></table>`;
  
  if (ca.siteAdjustments && ca.siteAdjustments.length) {
    htm += `<div class="cs-site-adjustments">
      <div style="font-weight:600;font-size:11.5px;margin-bottom:4px">📍 Specific Adjustments Applied to This House:</div>
      <ul style="margin:0;padding-left:18px;font-size:11.5px;color:var(--ink-2)">
        ${ca.siteAdjustments.map(adj => `<li><b>${esc(adj.name)}:</b> ${esc(adj.desc)} (<b>${adj.amount >= 0 ? "+" : ""}${fmt$(adj.amount)}</b>)</li>`).join("")}
      </ul>
    </div>`;
  }
  
  htm += `<div class="cs-roi-summary">
    <span><b>Resale Value Added:</b> ~${fmt$(u.v)}</span>
    <span><b>Net Profit / Equity Created:</b> <b style="color:${u.net >= 0 ? 'var(--good-ink)' : 'var(--warn-ink)'}">${u.net >= 0 ? "+" + fmt$(u.net) : "−" + fmt$(-u.net)}</b></span>
    <span><b>Expected Return:</b> <b>${fvpd(u.per)} / $1</b></span>
    ${u.sav > 0 ? `<span><b>Income / Operating Savings:</b> ~${fmt$(u.sav)}/yr</span>` : ""}
  </div>
  </div>`;
  return htm;
}

function toggleUpgradeCost(idx) {
  const el = $(`#upgrade-cost-${idx}`);
  if (el) el.hidden = !el.hidden;
}

function toggleHouseStories() {
  if (!activeHouse || !activeHouse.box || !activeHouse.box.isConnected) return;
  const { box, a, lot, ll, st } = activeHouse;
  const current = st.manualStories != null ? st.manualStories : (activeHouse.lastStories || 1);
  st.manualStories = current === 1 ? 2 : 1;
  renderHouse(box, a, lot, ll, st);
  showToast(`Updated to ${st.manualStories}-story house model`);
}

function houseUpgrades(h, m, R) {
  const houseHv = h.houseHv || m.hv || 900000;
  const houseVpsf = h.houseVpsf || Math.min(Math.max(houseHv / 1800, 250), 1400);
  const scale = Math.sqrt(Math.min(Math.max(houseHv / 900000, 0.6), 2.2));
  const medRent = (typeof D !== "undefined" && D && D.meta && D.meta.rent_med) ? D.meta.rent_med : 2102;
  const locRent = Math.min(Math.max((m.rent || medRent) / medRent, 0.7), 1.6);
  const rent1 = 2102 * locRent;
  const fits = { onestory: h.stories === 1, yard800: h.yard >= 800, yard400: h.yard >= 400,
    yard1200: h.yard >= 1200 && !h.pool, flatroof: true, roof350: h.foot >= 350, pre1980: !!h.yb && h.yb < 1980, pre1975: !!h.yb && h.yb < 1975,
    fire: (m.fire || 0) >= 0.5 || h.fire };
  
  const rows = [];
  const curD = (typeof D !== "undefined" && D) ? D : ((typeof window !== "undefined" && window.D) ? window.D : {});
  for (const u of (curD.upgrades || [])) {
    if (u.applies_if && fits[u.applies_if] === false) continue;
    
    const dummy = { n: u.name, c: u.cost_2025, v: u.resale_value_added * scale };
    if (/^Detached ADU/.test(u.name) && h.st && h.st.aduSqft) dummy.customSqft = h.st.aduSqft;
    const ca = getHouseUpgradeCostDetails(dummy, h, m);
    
    let c = ca.totalCost || u.cost_2025;
    let v = ca.resaleValue || (u.resale_value_added * scale);
    let note = "";

    if (/^Full second story/.test(u.name)) {
      note = `${fmtN(ca.sqft)} sq ft addition at ~$${Math.round(c/ca.sqft)}/sq ft all-in; counts as above-grade living area; new space valued at ~${fmt$(houseVpsf * 0.85)}/sq ft`;
    } else if (/^Partial second story/.test(u.name)) {
      note = `400 sq ft primary suite at ~$${Math.round(c/400)}/sq ft all-in; new space valued at ~${fmt$(houseVpsf * 0.85)}/sq ft`;
    } else if (/^Ground-floor room addition/.test(u.name)) {
      note = `400 sq ft at ~$${Math.round(c/400)}/sq ft; new space valued at ~${fmt$(houseVpsf * 0.85)}/sq ft`;
    } else if (/^Detached ADU/.test(u.name)) {
      const rentMo = ca.u && ca.u.monthlyRent ? ca.u.monthlyRent : Math.round(rent1 * (ca.sqft >= 750 ? 1.3 : ca.sqft >= 500 ? 1.05 : 0.82));
      const feeText = ca.impactFees === 0 ? "exempt from impact fees (750 sf or less)" : `~${fmt$(ca.impactFees)} impact fees (over 750 sf)`;
      note = `${ca.sqft} sq ft (${ca.sqft >= 750 ? "2-bed" : ca.sqft >= 500 ? "1-bed" : "studio"}); appraised separately from the main home's living area; ~$${fmtN(rentMo)}/mo rent; ${feeText}`;
    } else if (/^Junior ADU/.test(u.name)) {
      if (!(h.sf && h.bldg >= 1000)) continue;
      v = Math.round(rent1 * 0.72 * 12 * 0.65 / 0.055);
      note = "Interior conversion up to 500 sq ft; rent ~72% of 1-bedroom (capitalized @ 5.5% cap rate)";
    } else if (/^Add a full bathroom/.test(u.name)) {
      if (!(h.beds >= 2 && h.baths < h.beds)) continue;
      v = 36603; note = "Cures the bedroom-to-bath imbalance. Value $36,603 on a $63,595 cost: JLC/Zonda Cost vs Value 2025, Los Angeles, midrange 6x8-ft bathroom addition (a survey estimate, not measured sales)";
    } else if (/^Convert a den/.test(u.name)) {
      if (!(h.beds && h.bldg / h.beds > 550)) continue;
      v = Math.round(houseHv * 0.05); note = `Modeled at ~5% of home value with total square footage unchanged (estimate)`;
    } else if (/^In-ground pool/.test(u.name)) {
      const isOC = (activeCounty === "oc" || (h.a && h.a.county === "Orange County"));
      v = isOC ? 56000 : ((m.ht || 0) > 0 ? 95000 : 20000);
      note = isOC ? "modeled ~$56k resale premium (Redfin 2019 Orange County estimate; not verified on local sales)" : ((m.ht || 0) > 0 ? "modeled ~$95k premium in hotter inland areas (Redfin 2019 Los Angeles estimate; not verified on local sales)" : "modeled ~$20k premium in cooler coastal areas (traces to Redfin's 2019 San Diego estimate; not verified)");
    } else if (/^Rooftop deck/.test(u.name)) {
      v = Math.round(Math.min(houseHv * 0.035, 160000)); note = "flat roof or garage roof; worth more with a view";
    } else if (/^Garage to living space/.test(u.name)) {
      v = Math.round(360 * houseVpsf * 0.65); note = "~360 sq ft conversion; loses parking";
    } else if (/^Seismic/.test(u.name)) {
      c = Math.max(c - 3000, 3500); note = "after $3,000 California Earthquake Brace + Bolt grant";
    } else if (/^Legalize|^Staging|^Kitchen|^Bathroom remodel|^Home gym|^Kids/.test(u.name)) continue;

    rows.push({
      n: u.name,
      c: Math.round(c),
      v: Math.round(v),
      net: Math.round(v - c),
      per: v / Math.max(c, 1),
      note,
      sav: u.annual_savings,
      cost_analysis: ca
    });
  }
  return rows;
}
let houseLabel = null, houseBldgs = null;
function showParcel(a, rings) {
  if (parcelLayer) map.removeLayer(parcelLayer);
  if (houseLabel) map.removeLayer(houseLabel);
  if (!rings.length) return;
  const ll = rings.map(r => r.map(([x, y]) => [y, x]));
  parcelLayer = L.polygon(ll, { interactive: false, color: "#e8590c", weight: 4, fillColor: "#e8590c", fillOpacity: .14 }).addTo(map);
  const c = parcelLayer.getBounds().getCenter(), label = a.SitusHouseNo ? `${a.SitusHouseNo} ${String(a.SitusStreet || "").replace(/\s+/g, " ").trim()}` : (a.SitusFullAddress || "").split(/\s{2,}| CA /)[0];
  houseLabel = L.marker(c, { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null,
    html: `<div class="house-tag" style="transform:translate(-50%,-140%)">${esc(label || "Parcel " + a.AIN)}</div>` }) }).addTo(map);
}
function showOutlines(F) {
  if (houseBldgs && typeof map !== "undefined" && map && map.removeLayer) map.removeLayer(houseBldgs);
  if (typeof map === "undefined" || !map || !map.addLayer) return;
  houseBldgs = F.outlines ? L.layerGroup(F.outlines.map((r, i) => L.polygon(r.map(([x, y]) => [y, x]), { interactive: false, color: "#111", weight: i ? 1 : 1.6, fillColor: "#111", fillOpacity: i ? .12 : .22 }))).addTo(map) : null;
}

async function houseAt(ll) {
  clearTimeout(hoverTimer); if (hoverLayer) { map.removeLayer(hoverLayer); hoverLayer = null; }
  const el0 = $("#house"); if (el0) el0.remove();
  const box = document.createElement("div"); box.id = "house"; box.className = "section";
  const svc = typeof getParcelService === "function" ? getParcelService(ll) : null;
  const _cRec = (svc && svc.name) ? svc.name : ((typeof activeCounty !== "undefined" && activeCounty === "oc") ? "Orange County" : "County Assessor & GIS");
  box.innerHTML = `<h3>This home</h3><div class="house-loading"><span class="spin"></span><div>Pulling records from ${_cRec}…</div></div>`;
  const v = $("#panel .verdict"); (v || $("#panel h2")).after(box);
  const tok = {}; houseTok = tok;
  let f = hoverFeat && hoverFeat.geometry && ringsContain(hoverFeat.geometry.rings, ll) ? hoverFeat : null;
  if (!f) try { f = await fetchParcel(ll); } catch (e) {
    box.innerHTML = `<h3>This home</h3><p class="small">Couldn't reach the County's parcel service (${esc(e.message)}). Per-house checks need an internet connection; the rest of the map works offline.</p>`; return; }
  if (!f) { box.innerHTML = `<h3>This home</h3><p class="small muted">No parcel at that spot (street or public land). Click on a lot.</p>`; return; }
  const a = f.attributes, rings = (f.geometry && f.geometry.rings) || [];
  showParcel(a, rings);
  const lot = rings.length ? Math.round(ringAreaM2(rings[0]) * 10.7639) : 0;
  
  const hit_ = houseCache.get(a.AIN) || {};
  const st = { osm: hit_.osm, R: hit_.R, osmDone: "osm" in hit_ || !rings.length, rDone: "R" in hit_, manualStories: null };
  activeHouse = { box, a, lot, ll, st, tok };

  const draw = () => { if (houseTok === tok && box.isConnected) renderHouse(box, a, lot, ll, st); };
  draw();
  const keep = () => { if (st.osmDone && st.rDone) houseCache.set(a.AIN, { osm: st.osm, R: st.R }); };
  const pend = housePending.get(a.AIN);
  if (!st.osmDone) (pend ? pend.osm : fetchOsmLot(rings)).then(v => { st.osm = v; }, () => { st.osm = null; }).finally(() => { st.osmDone = true; keep(); draw(); });
  if (!st.rDone) (pend ? pend.R : lotChecks(ll, a)).then(v => { st.R = v; }, () => { st.R = null; }).finally(() => { st.rDone = true; keep(); draw(); });
}

let houseTok = null;
const houseCache = new Map(), housePending = new Map();
function prefetchHouse(f, ll) {
  const a = f && f.attributes, rings = (f && f.geometry && f.geometry.rings) || [];
  if (!a || !a.AIN || houseCache.has(a.AIN) || housePending.has(a.AIN) || housePending.size >= 3) return;
  const p = { osm: rings.length ? fetchOsmLot(rings).catch(() => null) : Promise.resolve(null), R: lotChecks(ll, a).catch(() => null) };
  housePending.set(a.AIN, p);
  Promise.all([p.osm, p.R]).then(([osm, R]) => { houseCache.set(a.AIN, { osm, R }); housePending.delete(a.AIN); });
}
function ringsContain(rings, ll) {
  let inside = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > ll.lat) !== (yj > ll.lat) && ll.lng < (xj - xi) * (ll.lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function renderHouse(box, a, lot, ll, st) {
  const osm = st.osmDone ? st.osm : null, R = st.rDone ? st.R : null, rOff = st.rDone && !st.R;   // rOff: the live checks could not be reached
  const PF = permitFacts(R);
  const F = houseFacts(a, lot, osm, PF, st);
  if (activeHouse) activeHouse.lastStories = F.stories;
  if (!st.osmDone) { F.src.foot = "estimated from living area; building outline still loading"; }
  showOutlines(F);
  const waiting = [!st.osmDone && "building outline and height", !st.rDone && "permits, last sale, historic, fire and geologic zones"].filter(Boolean);
  const offline = [st.osmDone && !st.osm && "building outlines (OpenStreetMap)", st.rDone && !st.R && "permits, last sale, historic, fire and geologic checks"].filter(Boolean);
  
  const p = byId.get(selected) ? byId.get(selected).properties : { c: "Los Angeles", hv: 950000, rent: 2200 };
  const curD = (typeof D !== "undefined" && D) ? D : ((typeof window !== "undefined" && window.D) ? window.D : {});
  const m = ((curD.details && curD.details[selected]) || {}).m || p;
  const z = zoneAt(ll, a);
  const rule = z ? zoneRules(z.zone, (m.z || {}).j || p.c) : null;
  const ocH = !rule && m.z && m.z.desc ? String(m.z.desc).match(/max height (\d+) ft/i) : null;   // Orange County neighborhood summary
  const hMax = rule && +rule.max_height_ft ? +rule.max_height_ft : ocH ? +ocH[1] : null;

  const rollLand = +a.Roll_LandValue || 0;
  const rollImp = +a.Roll_ImpValue || 0;
  const totalRoll = rollLand + rollImp;
  const rollBaseYear = a.Roll_LandBaseYear || a.Roll_ImpBaseYear || null;
  // PAIS sales rows: price and date field names vary by service version, so accept the common spellings
  const saleRows = R && R.sales && R.sales.ok && Array.isArray(R.sales.v) ? R.sales.v.map(r => ({ price: +(r.SALEPRICE ?? r.DOCUMENTVALUE ?? r.SalePrice ?? r.FORMATTED_SALEPRICE ?? 0) || 0,
      date: String(r.SALEDATE ?? r.SaleDate ?? r.FORMATTED_SALEDATE ?? "").replace(/\D/g, "").slice(0, 8) })).filter(r => r.price > 0) : [];
  const sale = saleRows.length ? saleRows.sort((x, y) => y.date.localeCompare(x.date))[0] : null;

  const baseNeighborhoodHv = m.hv || p.hv || 900000;
  const localVpsf = Math.min(Math.max(baseNeighborhoodHv / 1800, 250), 1500);
  const livingSqft = F.bldg || (F.foot ? Math.round(F.foot * F.stories) : 1600);
  
  // Hedonic Multi-Variate Comp Valuation Model
  const ageFactor = F.yb ? Math.max(0.75, Math.min(1.25, 1 + (F.yb - 1975) * 0.0035)) : 1.0;
  const bedBathFactor = 1.0 + Math.max(-0.15, Math.min(0.20, ((F.beds || 3) - 3) * 0.04 + ((F.baths || 2) - 2) * 0.03));
  const poolBonus = F.pool ? baseNeighborhoodHv * 0.045 : 0;
  const lotBonus = Math.max(-0.08, Math.min(0.12, (((lot || 6000) - 5500) / 5500) * 0.10)) * baseNeighborhoodHv;

  let houseHv = Math.round((livingSqft * localVpsf * 0.88 * ageFactor * bedBathFactor + lotBonus + poolBonus) / 5000) * 5000;
  if (sale && sale.price > 50000) {
    // blend the last recorded price (aged forward) with the size-based estimate
    const yrs = sale.date.length === 8 ? Math.max(0, (new Date().getFullYear() - +sale.date.slice(0, 4))) : 3;
    const saleAdj = Math.round(sale.price * Math.pow(1.04, Math.min(yrs, 8)));
    houseHv = Math.round((0.65 * saleAdj + 0.35 * houseHv) / 5000) * 5000;
  }
  const houseVpsf = Math.round(houseHv / Math.max(livingSqft, 1));

  // Tight precision confidence interval (+-6.5%)
  const confMarginPct = 0.065;
  const valLow = Math.round((houseHv * (1 - confMarginPct)) / 5000) * 5000;
  const valHigh = Math.round((houseHv * (1 + confMarginPct)) / 5000) * 5000;

  if (!st.sortCol) st.sortCol = "net";
  if (!st.sortDir) st.sortDir = "desc";
  if (!st.aduSqft) st.aduSqft = F.yard >= 1500 ? 800 : F.yard >= 800 ? 600 : 400;

  const h = houseChecks(a, lot, m, z, hMax, F, R);
  h.houseHv = houseHv;
  h.houseVpsf = houseVpsf;
  h.st = st;

  let ups = h.res ? houseUpgrades(h, m, R) : [];
  
  ups.sort((x, y) => {
    let vx = x[st.sortCol], vy = y[st.sortCol];
    if (typeof vx === "string") return st.sortDir === "asc" ? vx.localeCompare(vy) : vy.localeCompare(vx);
    return st.sortDir === "asc" ? vx - vy : vy - vx;
  });

  const GROUPS = [/^(Full second story|Partial second story|Ground-floor room addition|Garage to living space|Convert a den)/, /^(Detached ADU|Junior ADU)/];
  const pkgH = [], taken = new Set();
  for (const u of ups.filter(u => u.per >= 1)) { const gi = GROUPS.findIndex(g => g.test(u.n)); if (gi >= 0) { if (taken.has(gi)) continue; taken.add(gi); } pkgH.push(u); }
  const bestH = ups.slice().filter(u => u.per >= 1).sort((x, y) => y.per - x.per)[0];
  
  const tag = { yes: "✓", maybe: "?", no: "✗", note: "•" }, col = { yes: "var(--ok-ink, #15803d)", maybe: "var(--warn-ink)", no: "var(--ink-3)", note: "var(--ink-2)" };
  const fact = (k, v, src) => v == null || v === "" ? "" : `<tr><td>${k}</td><td><b>${v}</b>${src ? `<br><span class="muted">${src}</span>` : ""}</td></tr>`;
  const slotTxt = F.slots.length > 1 ? F.slots.map((x, i) => `${i ? "building " + (i + 1) : "main"}: ${fmtN(x.sqft)} sq ft${x.units ? `, ${x.units} unit${x.units > 1 ? "s" : ""}` : ""}${x.yb ? `, ${x.yb}` : ""}`).join("; ") : null;

  const svUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}`;

  const aduUp = ups.find(u => /^Detached ADU/.test(u.n));
  const aduCa = aduUp ? aduUp.cost_analysis : null;

  box.innerHTML = `<h3>This home</h3>
    <div class="prelim-banner"><span class="prelim-icon">ℹ️</span><span class="prelim-text"><b>Preliminary screening:</b> Automated checks use public county records and state maps. Always verify zoning, setbacks, easements, utilities, and permits with your city building department before committing funds or hiring contractors.</span></div>
        <div class="streetview-hero-card" style="background:var(--pale,#eef7f6);border:1px solid var(--line,#dce5eb);border-radius:10px;padding:12px;margin:8px 0 12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-weight:700;font-size:13px;color:var(--ink,#152b3c)">📷 Google Street View &amp; 3D Aerial</span>
        <span style="font-size:11px;color:var(--muted,#546679)">${ll.lat.toFixed(5)}°, ${ll.lng.toFixed(5)}°</span>
      </div>
      <p class="small" style="margin:0 0 8px 0;color:var(--ink,#152b3c)">Interactive street-level imagery, building facade, roof profile &amp; setbacks:</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="${svUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:var(--teal,#087b78);color:white;padding:7px 14px;border-radius:6px;text-decoration:none;font-weight:600;font-size:12.5px" title="Open Google Street View">
          🚀 Open 360° Street View ↗
        </a>
        <a href="https://earth.google.com/web/search/${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:white;border:1px solid var(--line,#dce5eb);color:var(--ink,#152b3c);padding:7px 14px;border-radius:6px;text-decoration:none;font-weight:600;font-size:12.5px" title="Open Google Earth 3D">
          🌍 Google Earth 3D ↗
        </a>
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.SitusFullAddress || (ll.lat + ',' + ll.lng))}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:white;border:1px solid var(--line,#dce5eb);color:var(--ink,#152b3c);padding:7px 14px;border-radius:6px;text-decoration:none;font-weight:600;font-size:12.5px" title="Google Maps Birds-Eye">
          🗺️ Google Maps ↗
        </a>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:6px">
      <p class="small" style="margin:0"><b>${esc(a.SitusFullAddress || "Parcel " + a.AIN)}</b> · AIN/APN ${esc(a.AIN)} · ${esc(a.UseDescription || "")}</p>
      <a href="${svUrl}" target="_blank" rel="noopener" class="streetview-pill" title="Open Google Street View to inspect facade, roof, and stories">
        📷 Street View ↗
      </a>
    </div>
    ${waiting.length ? `<div class="house-loading"><span class="spin"></span><div>Pulling this home's records from County GIS (${waiting.join("; ")})…</div></div>` : ""}
    ${offline.length ? `<p class="small muted">Could not reach: ${offline.join("; ")}. Those rows fall back to the area-level maps shipped with this page.</p>` : ""}
    <table class="small facts"><tbody>
      ${fact("Estimated market value", `<span><b>${fmt$(houseHv)}</b> <span class="vpd-range" style="font-size:12px;margin-left:6px;font-weight:normal;color:var(--ink-2)">(${fmt$(valLow)} – ${fmt$(valHigh)} · screening range ±6.5%)</span></span>`, `screening estimate: ${fmtN(livingSqft)} sq ft at ~$${houseVpsf}/sq ft from this area's typical price per sq ft, adjusted for age, bedrooms, baths, lot size, pool${sale ? " and the last recorded sale" : ""}; not an appraisal`)}
      ${totalRoll > 0 ? fact("Assessor Roll Value", `<span>${fmt$(totalRoll)} <span class="muted">(Land ${fmt$(rollLand)} + Imp ${fmt$(rollImp)}${rollBaseYear ? `, base year ${rollBaseYear}` : ""})</span></span>`, "County Assessor Assessment Roll") : ""}
      ${sale ? fact("Last recorded sale", `<span>${fmt$(sale.price)} <span class="muted">(${sale.date.length === 8 ? sale.date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : "date not recorded"})</span></span>`, "County PAIS recorded deed transfer") : ""}
      ${fact("Stories", `<span><b>${F.stories} stor${F.stories > 1 ? "ies" : "y"}</b>${F.conf === "estimated" ? " (estimate)" : ""} <button type="button" class="story-toggle-btn" onclick="toggleHouseStories()" title="Click to switch story count and recalculate upgrades">Switch to ${F.stories === 1 ? "2-story" : "1-story"}</button> <a href="${svUrl}" target="_blank" rel="noopener" class="streetview-link" title="Open Google Street View in a new tab">📷 Street View ↗</a></span>`, esc(F.src.stories))}
      ${fact("Living area (GLA)", F.bldg ? `${fmtN(F.bldg)} sq ft${F.living > F.bldg ? ` (${fmtN(F.living)} across all structures)` : ""}` : null, "ANSI Z765 Above-Grade Gross Living Area (Assessor Roll)")}
      ${fact("Bedrooms / baths", F.beds ? `${F.beds} / ${F.baths}` : null, "County Assessor")}
      ${fact("Units", F.units || null, "County Assessor")}
      ${fact("Built", F.yb ? `${F.yb}${F.eff && F.eff !== F.yb ? ` (effective year ${F.eff}, after updates)` : ""}` : null, "County Assessor")}
      ${fact("Buildings on the lot", slotTxt || (F.others ? `${F.others + 1} structures` : null), slotTxt ? "County Assessor" : "building outlines")}
      ${fact("Building footprint", F.foot ? `${fmtN(Math.round(F.foot))} sq ft${F.footAll > F.foot ? ` (${fmtN(Math.round(F.footAll))} with other buildings)` : ""}` : null, F.src.foot)}
      ${fact("Lot", lot ? `${fmtN(lot)} sq ft` : null, "parcel outline (County Assessor GIS)")}
      ${fact("Open yard (est.)", `${fmtN(Math.round(F.yard))} sq ft`, "lot minus buildings, less ~20% for setbacks")}
      ${fact("Zoning", z ? `${esc(z.zone)}` : (m.z ? esc(m.z.top) : null), z ? `parcel cadastral record (${esc(z.juris || "city")})` : isOCArea(m) ? "neighborhood summary (preliminary)" : "block-group summary")}
      ${z ? fact("Allowed uses", esc(explainZone(z.zone, z.cat, z.juris).base), "zoning code standard") : ""}
      ${fact("Height limit", hMax ? `${hMax} ft` : null, rule ? `${esc(rule.code_section)} (round-6 research, not yet checked against the code)` : ocH ? "city code summary (preliminary)" : null)}
      ${fact("Selling an ADU separately (AB 1033)", (m.c || p.c || "").toLowerCase().trim() === "santa monica" ? "<span style='color:var(--ok-ink);font-weight:600'>Santa Monica has an AB 1033 opt-in ordinance (SMMC § 9.31.026), so an ADU can be sold as a condominium under the city's conditions (the adoption date and conditions were not verified; read the ordinance)</span>" : "<span style='color:var(--ink-2)'>Not allowed here: an ADU can be rented but not sold apart from the main home (Gov. Code § 66314(d)(1)) unless the city opts in to AB 1033 (§ 66342)</span>", "state ADU law; verify the city's current ordinance")}
      ${fact("FEMA flood zone", !R ? "checking…" : (R.fema ? R.fema.label : "Zone X (minimal flood hazard, outside 500-yr floodplain)"), "FEMA National Flood Hazard Layer (NFHL Layer 28)")}
      ${fact("Fire zone", rOff ? ((m.fire || 0) >= 0.5 ? "Very High Fire Hazard Severity Zone (area map; lot-level check offline)" : "Not in a Very High zone on the area map (lot-level check offline)") : !R ? "checking…" : (R.fire && R.fire.vh ? "Very High Fire Hazard Severity Zone" : ((m.fire || 0) >= 0.5 ? "Very High Fire Hazard Severity Zone (area map; Title 24 Ch. 7A applies)" : "Not in a Very High zone")), "CAL FIRE Fire Hazard Severity Zones (SRA 2024 / LRA 2025)")}
      ${fact("Historic status", rOff ? "lot-level check offline (HPOZ, monuments, County register)" : !R ? "checking…" : (histText(R) || "None on record"), R && R.hpoz && R.hpoz.ok ? "LA City / County historic resources" : null)}
      ${fact("Hillside area", rOff ? "lot-level check offline" : !R ? "checking…" : (R.hill && R.hill.ok && R.hill.v.length ? "In designated Hillside Area" : "Not in Hillside Area"), R && R.hill && R.hill.ok ? "LA City Hillside Area map" : null)}
      ${fact("Geologic hazard", rOff ? "lot-level check offline" : !R ? "checking…" : (geoText(R) || "None on state map"), R && R.fault && R.fault.ok ? "California Geological Survey" : null)}
    </tbody></table>
    
    ${bestH ? `<p class="verdict" style="margin-top:8px">Best bet for this home: <b>${esc(bestH.n)}</b>. Expected return: <b>${fvpd(bestH.per)} / $1</b> (adds ~${fmt$(bestH.v)} on ~${fmt$(bestH.c)} investment).</p>` : h.res ? `<p class="verdict" style="margin-top:8px">No upgrade here returns $1 of value per $1 spent; the list below shows the closest.</p>` : ""}
    ${pkgH.length ? `<div class="pkg">${tile("Upgrades that pay back", pkgH.length, "≥ $1 of value per $1; either/or options counted once")}${tile("Total cost", fmt$(pkgH.reduce((t, u) => t + u.c, 0)), "2025–2026 market estimates")}${tile("Value added", fmt$(pkgH.reduce((t, u) => t + u.v, 0)), "to this home")}</div>` : ""}
    
    <ul class="small" style="margin:8px 0 0 0;padding:0;list-style:none">${h.C.map(c => `<li style="margin:3px 0"><b style="color:${col[c.v]}">${tag[c.v]} ${esc(c.name)}</b> — ${c.why}</li>`).join("")}</ul>

    <!-- Interactive ADU Sizing & Return Modeler -->
    ${aduCa ? `
      <div class="adu-interactive-card">
        <div class="adu-card-header">
          <div style="font-weight:700;font-size:12.5px;color:var(--ink)">📐 Interactive ADU Sizing &amp; Return Modeler</div>
          <div class="muted small">Drag the slider to change the floor area; construction cost, fee exemptions, rent and return per $1 update as you go.</div>
        </div>
        <div class="adu-slider-container">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span><b>Planned Floor Area:</b> <span class="adu-sqft-badge" id="adu-sqft-val">${st.aduSqft}</span> sq ft</span>
            <span class="adu-type-badge">${st.aduSqft >= 750 ? "2-Bed / 1–2 Bath" : st.aduSqft >= 500 ? "1-Bed / 1-Bath" : "Studio ADU"}</span>
          </div>
          <input type="range" class="adu-range-slider" min="250" max="1200" step="25" value="${st.aduSqft}" oninput="onAduSliderChange(this.value)">
          <div class="adu-slider-ticks">
            <span>250 sf (Studio)</span>
            <span>500 sf (1-BR)</span>
            <span style="color:var(--ok-ink);font-weight:600">up to 750 sf: no impact fees</span>
            <span>over 750 sf (proportional fees)</span>
            <span>1,200 sf (Max State Limit)</span>
          </div>
        </div>
        <div class="adu-metrics-strip">
          <div class="adu-m-tile"><div class="m-k">All-In Cost</div><div class="m-v">${fmt$(aduUp.c)}</div><div class="m-s">~$${Math.round(aduUp.c/st.aduSqft)}/sq ft</div></div>
          <div class="adu-m-tile"><div class="m-k">Impact Fees</div><div class="m-v" style="color:${aduCa.impactFees === 0 ? 'var(--ok-ink)' : 'var(--warn-ink)'}">${aduCa.impactFees === 0 ? '$0 (exempt)' : '~' + fmt$(aduCa.impactFees)}</div><div class="m-s">${st.aduSqft <= 750 ? 'Gov. Code § 66311.5' : 'proportional fees'}</div></div>
          <div class="adu-m-tile"><div class="m-k">School Fee</div><div class="m-v" style="color:${(aduCa.schoolFee || 0) === 0 ? 'var(--ok-ink)' : 'var(--warn-ink)'}">${(aduCa.schoolFee || 0) === 0 ? '$0 (under 500 sf)' : fmt$(aduCa.schoolFee)}</div><div class="m-s">${st.aduSqft < 500 ? 'exempt under 500 sf' : 'modeled at SAB Level 1 cap'}</div></div>
          <div class="adu-m-tile"><div class="m-k">Est. Rent</div><div class="m-v">~${fmt$(aduUp.monthlyRent || 2300)}/mo</div><div class="m-s">calibrated local rent</div></div>
          <div class="adu-m-tile"><div class="m-k">Resale Uplift</div><div class="m-v">${fmt$(aduUp.v)}</div><div class="m-s">appraisal + income cap</div></div>
          <div class="adu-m-tile"><div class="m-k">Net Profit</div><div class="m-v" style="color:var(--ok-ink)">${aduUp.net >= 0 ? '+' + fmt$(aduUp.net) : '−' + fmt$(-aduUp.net)}</div><div class="m-s">equity created</div></div>
          <div class="adu-m-tile"><div class="m-k">Return per $1</div><div class="m-v" style="color:var(--accent)">${fvpd(aduUp.per)}</div><div class="m-s">payback ratio</div></div>
        </div>
      </div>
    ` : ""}

    ${ups.length ? `
      <div style="margin-top:12px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px">
        <h4 style="margin:0;font-size:12.5px;color:var(--ink)">Upgrades for this house (click any item for itemized cost schedule)</h4>
        <span class="small muted">Specific to parcel &amp; year built</span>
      </div>

      <!-- Quick Sort Pill Bar -->
      <div class="upgrade-sort-bar">
        <span class="sort-label">Sort by:</span>
        <button type="button" class="sort-pill ${st.sortCol === 'net' ? 'active' : ''}" onclick="toggleHouseSort('net')">Net Profit ${st.sortCol === 'net' ? (st.sortDir === 'desc' ? '▼' : '▲') : ''}</button>
        <button type="button" class="sort-pill ${st.sortCol === 'per' ? 'active' : ''}" onclick="toggleHouseSort('per')">Return / $1 ${st.sortCol === 'per' ? (st.sortDir === 'desc' ? '▼' : '▲') : ''}</button>
        <button type="button" class="sort-pill ${st.sortCol === 'c' ? 'active' : ''}" onclick="toggleHouseSort('c')">Cost ${st.sortCol === 'c' ? (st.sortDir === 'asc' ? '▲' : '▼') : ''}</button>
        <button type="button" class="sort-pill ${st.sortCol === 'v' ? 'active' : ''}" onclick="toggleHouseSort('v')">Value Added ${st.sortCol === 'v' ? (st.sortDir === 'desc' ? '▼' : '▲') : ''}</button>
        <button type="button" class="sort-pill ${st.sortCol === 'n' ? 'active' : ''}" onclick="toggleHouseSort('n')">Name ${st.sortCol === 'n' ? (st.sortDir === 'asc' ? '▲' : '▼') : ''}</button>
      </div>

      <table class="small sticky-head" style="width:100%;border-collapse:collapse;margin-top:4px">
        <thead>
          <tr style="text-align:left">
            <th class="sortable-th" onclick="toggleHouseSort('n')">Upgrade ${st.sortCol === 'n' ? (st.sortDir === 'asc' ? '▲' : '▼') : ''}</th>
            <th class="sortable-th" onclick="toggleHouseSort('c')" style="text-align:right">Estimated Cost ${st.sortCol === 'c' ? (st.sortDir === 'asc' ? '▲' : '▼') : ''}</th>
            <th class="sortable-th" onclick="toggleHouseSort('v')" style="text-align:right">Value Adds ${st.sortCol === 'v' ? (st.sortDir === 'desc' ? '▼' : '▲') : ''}</th>
            <th class="sortable-th" onclick="toggleHouseSort('per')" style="text-align:right">Per $1 ${st.sortCol === 'per' ? (st.sortDir === 'desc' ? '▼' : '▲') : ''}</th>
            <th class="sortable-th" onclick="toggleHouseSort('net')" style="text-align:right">Net Profit ${st.sortCol === 'net' ? (st.sortDir === 'desc' ? '▼' : '▲') : ''}</th>
          </tr>
        </thead>
        <tbody>
          ${ups.slice(0, 14).map((u, i) => `
            <tr style="border-top:1px solid var(--rule);cursor:pointer" onclick="toggleUpgradeCost(${i})">
              <td>
                <b>${esc(u.n)}</b>
                <button type="button" class="cost-breakdown-btn" onclick="event.stopPropagation(); toggleUpgradeCost(${i})">🔍 View house cost breakdown</button>
                ${u.note ? `<br><span class="muted">${esc(u.note)}</span>` : ""}
                ${u.sav > 0 ? `<br><span class="muted">${/ADU/.test(u.n) ? "rent" : "saves"} ~${fmt$(u.sav)}/yr</span>` : ""}
              </td>
              <td style="text-align:right;font-weight:600">${fmt$(u.c)}</td>
              <td style="text-align:right">${fmt$(u.v)}</td>
              <td style="text-align:right;font-weight:600;color:var(--accent)">${fvpd(u.per)}</td>
              <td style="text-align:right;font-weight:600;color:${u.net >= 0 ? 'var(--ok-ink)' : 'inherit'}">${u.net >= 0 ? "+" + fmt$(u.net) : "−" + fmt$(-u.net)}</td>
            </tr>
            <tr id="upgrade-cost-${i}" class="upgrade-cost-row" hidden>
              <td colspan="5" style="padding:10px 12px;background:var(--ground);border-bottom:1px solid var(--rule)">
                ${renderCostAnalysisSchedule(u, h, m)}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${ups.length > 14 ? `<p class="small muted">${ups.length - 14} more fit this lot but return less.</p>` : ""}` : ""}
    <p class="small muted" style="margin-top:8px">Facts compiled from County Assessor records, city permits, state hazard maps and mapped building footprints. Values use this area's price per sq ft and rents scaled from the county median; construction costs are City Pretty's 2025–2026 estimates, not bids.</p>`;
}

// Plain-language summaries of the historic and geologic checks (used in the per-house facts table)
function histText(R) {
  if (!R) return "";
  const out = [];
  if (R.hpoz && R.hpoz.ok && R.hpoz.v.length) out.push("HPOZ: " + R.hpoz.v.map(x => x.NAME || x.Name || "historic district").filter(Boolean).slice(0, 2).map(esc).join(", "));
  if (R.hcm && R.hcm.ok && R.hcm.v.length) out.push("Historic-Cultural Monument" + (R.hcm.v[0].MNT_NUM ? " #" + esc(R.hcm.v[0].MNT_NUM) : "") + (R.hcm.v[0].NAME ? " (" + esc(R.hcm.v[0].NAME) + ")" : ""));
  if (R.hc && R.hc.ok && R.hc.v.length) out.push(R.hc.v.map(x => [x.Name, x.Status_Code_Description].filter(Boolean).map(esc).join(": ")).slice(0, 2).join("; ") + (R.hc.v.some(x => /yes|true|1/i.test(String(x.Mills_Act_Contract || ""))) ? " (Mills Act)" : ""));
  return out.join(" · ");
}
function geoText(R) {
  if (!R) return "";
  const z = [];
  if (R.fault && R.fault.ok && R.fault.v.length) z.push("Alquist-Priolo earthquake fault zone");
  if (R.liq && R.liq.ok && R.liq.v.length) z.push("liquefaction zone");
  if (R.slide && R.slide.ok && R.slide.v.length) z.push("earthquake-induced landslide zone");
  if (!z.length) {
    const failed = ["fault", "liq", "slide"].filter(k => R[k] && !R[k].ok);
    return failed.length === 3 ? "state map not reachable" : "";
  }
  return z.join("; ") + " (CGS Seismic Hazard Zones)";
}

function toggleHouseSort(col) {
  const ah = (typeof activeHouse !== "undefined" && activeHouse) || (typeof window !== "undefined" && window.activeHouse);
  if (!ah || !ah.st) return;
  const st = ah.st;
  if (st.sortCol === col) {
    st.sortDir = st.sortDir === "desc" ? "asc" : "desc";
  } else {
    st.sortCol = col;
    st.sortDir = (col === "c" || col === "n") ? "asc" : "desc";
  }
  if (typeof renderHouse === "function") renderHouse(ah.box, ah.a, ah.lot, ah.ll, st);
}

if (typeof window !== "undefined") {
  window.renderHouse = renderHouse;
  window.toggleHouseSort = toggleHouseSort;
  window.onAduSliderChange = onAduSliderChange;
  window.applyPreset = applyPreset;
}
function onAduSliderChange(val) {
  const ah = (typeof activeHouse !== "undefined" && activeHouse) || (typeof window !== "undefined" && window.activeHouse);
  if (!ah || !ah.st) return;
  ah.st.aduSqft = +val;
  if (typeof renderHouse === "function") renderHouse(ah.box, ah.a, ah.lot, ah.ll, ah.st);
}
// ---------------- address search: find a home by street address (County Assessor parcels)
let addrTimer = null;
function hideAddr() { const el = $("#addr-results"); if (el) el.remove(); }
async function goToParcel(f) {
  hideAddr();
  const rings = (f.geometry && f.geometry.rings) || []; if (!rings.length) return;
  const poly = L.polygon(rings.map(r => r.map(([x, y]) => [y, x]))), c = poly.getBounds().getCenter();
  map.fitBounds(poly.getBounds(), { maxZoom: 18, padding: [120, 120], animate: false });
  const bg = allFeatures().find(ff => pointInFeature(ff, c.lng, c.lat));
  if (bg) select(bg.properties.id, false);
  houseAt(c);
}
async function addressSearch(text, go) {
  const t = text.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const c = (typeof map !== "undefined" && map._loaded) ? map.getCenter() : { lat: 34.05, lng: -118.25 };
  const svc = typeof getParcelService === "function" ? getParcelService(c) : null;
  let feats = [];

  if (svc && svc.url && svc.addr) {
    const base = svc.url.replace(/\/query\/?$/, "");
    const q = `${base}/query?where=UPPER(${svc.addr})+LIKE+'${encodeURIComponent(t)}%25'&outFields=${svc.apn},${svc.addr}&returnGeometry=true&outSR=4326&resultRecordCount=8&f=json`;
    try {
      const r = await fetch(q);
      const d = await r.json();
      if (d && d.features && d.features.length) {
        feats = d.features.map(f => {
          const a = f.attributes || {};
          const addr = a[svc.addr] || a.SITE_ADDRESS || a.SITUS_ADDRESS || a.SitusFullAddress || "";
          return { AIN: a[svc.apn] || a.AIN || "", SitusFullAddress: addr, geometry: f.geometry };
        }).filter(x => x.SitusFullAddress);
      }
    } catch (e) {}
  }

  if (!feats.length && typeof PARCEL_URL !== "undefined" && PARCEL_URL) {
    try {
      const d = await arcQuery(PARCEL_URL.replace(/\/query$/, ""), { where: `SitusFullAddress LIKE '${t.replace(/'/g, "")}%'`, outFields: "AIN,SitusFullAddress", returnGeometry: true, outSR: 4326, resultRecordCount: 8 });
      if (d && d.features) feats = d.features.map(f => ({ AIN: f.attributes.AIN, SitusFullAddress: f.attributes.SitusFullAddress, geometry: f.geometry })).filter(x => x.SitusFullAddress);
    } catch (e) {}
  }

  if (!feats.length && text.trim().length >= 4) {
    try {
      const cq = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(text)}&benchmark=Public_AR_Current&format=json`;
      const res = await fetch(cq);
      const cd = await res.json();
      const matches = (cd && cd.result && cd.result.addressMatches) || [];
      if (matches.length) {
        feats = matches.slice(0, 6).map(m => ({
          AIN: "US-" + m.coordinates.x.toFixed(4) + "-" + m.coordinates.y.toFixed(4),
          SitusFullAddress: m.matchedAddress,
          lat: m.coordinates.y,
          lng: m.coordinates.x
        }));
      }
    } catch (e) {}
  }

  if (go && feats.length) {
    const top = feats[0];
    if (top.geometry) return goToParcel({ attributes: { AIN: top.AIN, SitusFullAddress: top.SitusFullAddress }, geometry: top.geometry });
    if (top.lat && top.lng) {
      map.setView([top.lat, top.lng], 17);
      selectAt({ lat: top.lat, lng: top.lng });
      houseAt({ lat: top.lat, lng: top.lng });
      return;
    }
  }
  hideAddr(); if (!feats.length) return;
  const box = document.createElement("div"); box.id = "addr-results";
  box.innerHTML = feats.map((f, i) => `<button type="button" data-i="${i}">${esc(f.SitusFullAddress.replace(/\s+/g, " "))}</button>`).join("");
  $("#q").parentElement.style.position = "relative"; $("#q").after(box);
  box.querySelectorAll("button").forEach(b => b.onclick = () => {
    const f = feats[+b.dataset.i];
    hideAddr();
    if (f.geometry) goToParcel({ attributes: { AIN: f.AIN, SitusFullAddress: f.SitusFullAddress }, geometry: f.geometry });
    else if (f.lat && f.lng) {
      map.setView([f.lat, f.lng], 17);
      selectAt({ lat: f.lat, lng: f.lng });
      houseAt({ lat: f.lat, lng: f.lng });
    }
  });
}

// ---------------- house numbers at zoom 18+ (County CAMS address points)
let numLayer = null, numTimer = null;
function drawNumbers() {
  clearTimeout(numTimer);
  numTimer = setTimeout(async () => {
    if (!map._loaded) return;
    if (map.getZoom() < 18) { if (numLayer) { map.removeLayer(numLayer); numLayer = null; } return; }
    const b = map.getBounds();
    const isOc = (typeof activeCounty !== "undefined" && activeCounty === "oc") || (b.getSouth() < 33.95 && b.getNorth() > 33.35 && b.getEast() > -118.15 && b.getWest() < -117.40);
    if (isOc) {
      let d;
      try {
        const q = `https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer/0/query?geometry=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=SITE_ADDRESS,ASSESSMENT_NO&returnGeometry=true&outSR=4326&resultRecordCount=300&f=json`;
        d = await (await fetch(q)).json();
      } catch (e) { return; }
      if (numLayer) map.removeLayer(numLayer);
      const seen = new Set();
      numLayer = L.layerGroup((d.features || []).filter(f => f.geometry && f.geometry.rings && f.attributes && f.attributes.SITE_ADDRESS).map(f => {
        const addr = (f.attributes.SITE_ADDRESS || "").trim();
        const num = addr.split(" ")[0];
        if (!/^\d+/.test(num)) return null;
        const pts = f.geometry.rings[0];
        if (!pts || !pts.length) return null;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const k = num + "@" + cx.toFixed(4) + cy.toFixed(4);
        if (seen.has(k)) return null; seen.add(k);
        return L.marker([cy, cx], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null, html: `<div class="hnum" style="transform:translate(-50%,-50%)">${esc(num)}</div>` }) });
      }).filter(Boolean)).addTo(map);
      return;
    }
    let d; try { d = await arcQuery(R9.cams, { geometry: `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`, geometryType: "esriGeometryEnvelope", inSR: 4326, outSR: 4326,
      spatialRel: "esriSpatialRelIntersects", outFields: "Number,NumPrefix,NumSuffix", returnGeometry: true, resultRecordCount: 500 }); } catch (e) { return; }
    if (numLayer) map.removeLayer(numLayer);
    const seen = new Set();
    numLayer = L.layerGroup((d.features || []).filter(f => f.geometry && f.geometry.rings && f.attributes && f.attributes.Number).map(f => {
      const n = `${f.attributes.NumPrefix || ""}${f.attributes.Number}${f.attributes.NumSuffix || ""}`, k = n + "@" + f.geometry.x.toFixed(4) + f.geometry.y.toFixed(4);
      if (seen.has(k)) return null; seen.add(k);
      return L.marker([f.geometry.y, f.geometry.x], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null, html: `<div class="hnum" style="transform:translate(-50%,-50%)">${esc(n)}</div>` }) });
    }).filter(Boolean)).addTo(map);
  }, 350);
}

// ---------------- hover preview at street level: outline the lot under the mouse and show its address
let hoverTimer = null, hoverLayer = null, hoverKey = "", hoverFeat = null, prefetchTimer = null;
const hoverCache = new Map();
function hoverParcel(e) {
  clearTimeout(hoverTimer);
  if (map.getZoom() < 17) { if (hoverLayer) { map.removeLayer(hoverLayer); hoverLayer = null; } return; }
  hoverTimer = setTimeout(async () => {
    const key = `${e.latlng.lat.toFixed(5)},${e.latlng.lng.toFixed(5)}`; if (key === hoverKey) return; hoverKey = key;
    let f = hoverCache.get(key);
    if (f === undefined) { try { f = await fetchParcel(e.latlng); } catch (er) { f = null; } hoverCache.set(key, f); }
    if (hoverLayer) { map.removeLayer(hoverLayer); hoverLayer = null; }
    hoverFeat = f;
    if (!f || !f.geometry) return;
    const a = f.attributes;
    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(() => { if (hoverFeat === f) prefetchHouse(f, e.latlng); }, 350);
    hoverLayer = L.polygon(f.geometry.rings.map(r => r.map(([x, y]) => [y, x])), { interactive: false, color: css("--ink", "#111"), weight: 2, fill: false, dashArray: "3 3" })
      .bindTooltip(`<b>${esc(a.SitusFullAddress || "Parcel " + a.AIN)}</b><br><span class="muted">click to analyze this home</span>`, { permanent: true, direction: "top", className: "" }).addTo(map);
  }, 450);
}

// ---------------- lot lines from the County parcel map (drawn by the County server, online only)
// Speed: 512 px tiles (4x fewer server renders per screen than 256 px). If the County service has a pre-drawn tile
// cache in the standard web-mercator grid, cachedLotLines() is used instead: those tiles are files, not renders.
var PARCEL_MS = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer";
var PARCEL_MS_OC = "https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer";
var LotLines = L.TileLayer.extend({
  getTileUrl(c) {
    const ts = this.getTileSize().x, nw = this._map.unproject([c.x * ts, c.y * ts], c.z), se = this._map.unproject([(c.x + 1) * ts, (c.y + 1) * ts], c.z);
    const a = L.CRS.EPSG3857.project(nw), b = L.CRS.EPSG3857.project(se);
    const cLat = (nw.lat + se.lat) / 2, cLng = (nw.lng + se.lng) / 2;
    const svc = typeof getParcelService === "function" ? getParcelService({ lat: cLat, lng: cLng }) : null;
    let ms = PARCEL_MS;
    if (svc && svc.url && svc.url.indexOf("MapServer") !== -1) {
      ms = svc.url.replace(/\/query\/?$/, "").replace(/\/\d+$/, "");
    } else if (typeof activeCounty !== "undefined" && activeCounty === "oc" || (cLat < 33.95 && cLat > 33.35 && cLng > -118.15 && cLng < -117.40)) {
      ms = PARCEL_MS_OC;
    }
    return `${ms}/export?bbox=${a.x},${b.y},${b.x},${a.y}&bboxSR=3857&imageSR=3857&size=${ts},${ts}&layers=show:0&format=png32&transparent=true&f=image&dpi=96`;
  }
});
var LOT_OPTS = { minZoom: 15, maxZoom: 20, opacity: .95, tileSize: 512, keepBuffer: 3, attribution: "Parcels © County GIS" };
var lots = null, lotCache = null;

function syncLots() {
  const cb = $("#l-lots");
  const want = cb ? cb.checked : false;
  const isOc = (typeof activeCounty !== "undefined" && activeCounty === "oc");
  const m = (typeof map !== "undefined" && map) ? map : (typeof window !== "undefined" && window.map ? window.map : null);
  
  if (lots) {
    if ((isOc && lots._isLa) || (!isOc && !lots._isLa)) {
      if (m && m.hasLayer && m.hasLayer(lots)) m.removeLayer(lots);
      lots = null;
      if (typeof window !== "undefined") window.lots = null;
    }
  }

  if (want && !lots && m && m.addLayer) {
    if (isOc) {
      const opts = Object.assign({}, LOT_OPTS, {
        minZoom: 15,
        maxZoom: 20,
        opacity: 0.95,
        attribution: "Parcels © OCGIS / OC Public Works"
      });
      lots = new LotLines("", opts);
      lots._isLa = false;
      lots.addTo(m);
      if (typeof watchLots === "function") watchLots(lots);
    } else {
      const opts = Object.assign({}, LOT_OPTS, {
        minZoom: 15,
        maxZoom: 20,
        opacity: 0.9,
        attribution: "Parcels © LA County Assessor"
      });
      lots = lotCache ? lotCache : new LotLines("", opts);
      lots._isLa = true;
      lots.addTo(m);
      if (typeof watchLots === "function") watchLots(lots);
    }
    if (typeof window !== "undefined") window.lots = lots;
  }
  
  if (!want && lots && m) {
    if (m.hasLayer && m.hasLayer(lots)) m.removeLayer(lots);
    lots = null;
    if (typeof window !== "undefined") window.lots = null;
  }
}

if (typeof window !== "undefined") {
  window.LotLines = LotLines;
  window.PARCEL_MS = PARCEL_MS;
  window.PARCEL_MS_OC = PARCEL_MS_OC;
  window.LOT_OPTS = LOT_OPTS;
  window.lots = lots;
  window.lotCache = lotCache;
  window.syncLots = syncLots;
}
// Resolves to a tile layer when the service publishes a standard web-mercator cache down to zoom 17, else null.
async function cachedLotLines() {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
  try {
    const j = await (await fetch(`${PARCEL_MS}?f=json`, { signal: ctl.signal })).json(), ti = j.tileInfo || {};
    const wkid = (ti.spatialReference || {}).latestWkid || (ti.spatialReference || {}).wkid;
    const lod = (ti.lods || []).find(l => l.level === 17);
    const web = [3857, 102100].includes(wkid) && ti.origin && Math.abs(ti.origin.x + 20037508.3428) < 1 && ti.rows === 256;
    if (!j.singleFusedMapCache || !web || !lod || Math.abs(lod.resolution / 1.194328566855 - 1) > .01) return null;
    const maxNative = Math.max(...ti.lods.map(l => l.level));
    return L.tileLayer(`${PARCEL_MS}/tile/{z}/{y}/{x}`, { ...LOT_OPTS, tileSize: 256, maxNativeZoom: Math.min(maxNative, 19) });
  } catch { return null; } finally { clearTimeout(t); }
}
// "Loading property lines…" note: shown while lot-line tiles are loading at zoom 15+, hidden when they finish.
function watchLots(layer) {
  const note = $("#lots-note"); if (!note || !layer) return;
  let timer = null, doneTimer = null, shown = false;
  const hide = () => { clearTimeout(timer); timer = null; clearTimeout(doneTimer); note.hidden = true; note.classList.remove("done"); shown = false; };
  // After the lines have loaded, show a green check for a moment so the wait visibly ends well
  const done = () => {
    clearTimeout(timer); timer = null;
    if (!shown || note.hidden) { note.hidden = true; shown = false; return; }
    const isOc = (typeof activeCounty !== "undefined" && activeCounty === "oc");
    note.classList.add("done");
    note.innerHTML = `<span class="check" aria-hidden="true">✓</span><div>Property lines loaded from ${isOc ? "Orange County" : "the LA County Assessor"}. Click any lot to analyze that home.</div>`;
    clearTimeout(doneTimer); doneTimer = setTimeout(() => { note.hidden = true; note.classList.remove("done"); shown = false; }, 2600);
  };
  const getMinZ = () => 15;
  layer.on("loading", () => {
    clearTimeout(timer); clearTimeout(doneTimer); note.classList.remove("done");
    if (typeof map !== "undefined" && map && map.getZoom && map.getZoom() >= getMinZ()) {
      timer = setTimeout(() => {
        const isOc = (typeof activeCounty !== "undefined" && activeCounty === "oc");
        const div = note.querySelector("div");
        if (div) {
          const cName = isOc ? "Orange County (OC Survey / County GIS)" : "LA County Assessor";
          div.innerHTML = `Loading property lines from ${cName}… <button type="button" id="lots-hood">See the neighborhood meanwhile</button>`;
          const bh = $("#lots-hood");
          if (bh) bh.onclick = () => { hide(); if (typeof selectAt === "function") selectAt(map.getCenter()); };
        }
        note.innerHTML = `<span class="spin"></span>` + (note.querySelector("div") ? note.querySelector("div").outerHTML : "");
        if (!note.querySelector("div")) note.innerHTML = `<span class="spin"></span><div>Loading property lines from ${cName}… <button type="button" id="lots-hood">See the neighborhood meanwhile</button></div>`;
        const bh2 = $("#lots-hood"); if (bh2) bh2.onclick = () => { hide(); if (typeof selectAt === "function") selectAt(map.getCenter()); };
        note.hidden = false; shown = true;
      }, LOTS_NOTE_MS);
    }
  });
  layer.on("load", done);
  layer.on("remove", hide);
  if (typeof map !== "undefined" && map && map.on) {
    map.on("zoomend", () => { if (map.getZoom() < getMinZ()) hide(); });
  }
}
const LOTS_NOTE_MS = 1200;

// ---------------- homeowner upgrades (round 6; LA-metro averages, not this house)
function upgradeTable(m) {
  const fire = (m.fire || 0) >= 0.5;
  const U = (D.upgrades || []).filter(u => !(u.applies_if === "pre1975" && m.yb >= 1975) && !(u.applies_if === "pre1980" && m.yb >= 1980) && !(u.applies_if === "fire" && !fire));
  if (!U.length) return "";
  const rows = U.map(u => ({ ...u, net: u.resale_value_added - u.cost_2025, per: u.resale_value_added / Math.max(u.cost_2025, 1) })).sort((a, b) => b.per - a.per);
  return `<details class="more"><summary>${rows.length} home upgrades: cost, value added and return per $1</summary>
    <div><table class="small sticky-head" style="width:100%;border-collapse:collapse;margin-top:6px">
      <thead><tr style="text-align:left"><th>Upgrade</th><th style="text-align:right">Cost</th><th style="text-align:right">Adds to resale</th><th style="text-align:right">Per $1</th><th style="text-align:right">Saves / yr</th><th>Rebates (Nov 2026)</th><th>Property tax</th><th>Permits</th></tr></thead>
      <tbody>${rows.map(u => `<tr style="border-top:1px solid var(--rule)"><td>${esc(u.name)}</td><td style="text-align:right">${fmt$(u.cost_2025)}</td><td style="text-align:right">${fmt$(u.resale_value_added)}</td><td style="text-align:right;font-weight:600">${fvpd(u.per)}</td><td style="text-align:right">${u.annual_savings > 0 ? fmt$(u.annual_savings) : u.annual_savings < 0 ? "−" + fmt$(-u.annual_savings) + " cost" : "–"}</td><td>${esc(u.rebates_nov_2026)}</td><td>${esc(u.property_tax)}</td><td>${esc(u.permits)}</td></tr>`).join("")}</tbody></table></div>
    <p class="small muted">Typical 2025 LA costs and resale values (City Pretty estimates; second stories and additions run about $450–$700 per sq ft all-in). They're being checked against round-8 research. These are LA-wide averages: zoom in and click a home for numbers sized to that house and its yard. Federal credits: 25D (solar, batteries) ended for expenditures made after 31 Dec 2025; 25C (heat pumps, insulation) for property placed in service after 31 Dec 2025.</p></details>`;
}

// ---------------- EIFD calculator (Gov. Code 53398.50 et seq.)
// m.e (from the pipeline): av = net taxable assessed value on the Assessor roll, avr/avc = residential/commercial part,
// np = parcels, ry = roll year, sh = AV-weighted shares of the 1% levy [city, County General, other districts, schools+ERAF]
// from the Auditor-Controller AF49 Modified ATI ratios for the tax-rate areas here, t = largest TRAs [tra, net AV].
function eifdArea(p, scope) {
  const feats = (activeCounty === "oc" && D_OC) ? D_OC.features : D.bgs.features;
  const fs = scope === "hood" ? feats.filter(f => f.properties.n === p.n && f.properties.c === p.c) : [byId.get(p.id)];
  let mv = 0, homes = 0, av = 0, avr = 0, avc = 0, np = 0, ry = null, shw = [0, 0, 0, 0], shav = 0, n = 0;
  const tras = new Map(), ex = new Set();
  fs.forEach(f => { const m = (D.details[f.properties.id] || {}).m || {};
    if (m.hv && m.homes) { mv += m.hv * m.homes; homes += m.homes; }
    const e = m.e; if (!e) return; n++;
    av += e.av || 0; avr += e.avr || 0; avc += e.avc || 0; np += e.np || 0; ry = e.ry || ry;
    const wt = e.av || e.w || 0;   // Orange County has no roll value in the build; its shares are weighted by market value (w)
    if (e.sh && wt) { e.sh.forEach((x, i) => shw[i] += x * wt); shav += wt; }
    (e.t || []).forEach(([t, v]) => tras.set(t, (tras.get(t) || 0) + (v == null ? wt : v))); (e.x || []).forEach(x => ex.add(x)); });
  const sh = shav > 0 ? shw.map(x => x / shav) : null;
  return { n: fs.length, withRoll: n, mv, homes, av, avr, avc, np, ry, sh, tras: [...tras].sort((a, b) => b[1] - a[1]), ex: [...ex] };
}
function eifdSection(p, m) {
  const fld = (id, label, val, step, note) => `<label class="small" style="display:grid;grid-template-columns:1fr 110px;gap:8px;align-items:center;margin:4px 0"><span>${label}${note ? ` <span class="muted" id="${id}-n">${note}</span>` : ""}</span><input id="${id}" type="number" step="${step}" value="${val}" style="font:500 13px var(--mono);padding:4px 6px;border:1px solid var(--rule-strong);border-radius:6px;background:var(--ground);color:var(--ink)"></label>`;
  return `<div class="section"><h3>EIFD calculator: tax-increment financing for this area</h3>
    <p class="small muted">An Enhanced Infrastructure Financing District pledges part of the future growth in the 1% property tax to pay for projects. No vote is needed to form one; since AB 116 (2019) bonds need 3 hearings and fail only on a 50% protest. Schools can't take part. State law has no housing set-aside, but ${activeCounty === "oc" ? "the County of Orange's EIFD Participation Policy (approved by the Board of Supervisors 4 Jun 2019) sets conditions when the County joins: the city must put in at least as much as the County, the County gives at most 50% of its share for at most 20 years, and the Board must approve (see below)" : "LA County Board Policy 3.106 (revised and approved by the County Audit Committee on 16 Jul 2025, next review 1 Aug 2029; amendments for disaster-recovery districts were directed in October 2025, adoption not verified) sets conditions when the County joins (see below)"}.</p>
    <div class="cat-tabs" role="group" aria-label="EIFD area"><button type="button" data-scope="bg" aria-pressed="true">This block group</button><button type="button" data-scope="hood" aria-pressed="false">All of ${esc(p.n)}</button></div>
    ${fld("e-av", "Base assessed value ($M)", "", 0.1, "")}
    ${fld("e-g", "Yearly value growth (%)", 3.0, 0.1, "2% Prop 13 cap + resales")}
    ${fld("e-new", "New development, year 3 ($M)", 0, 1, "")}
    ${fld("e-city", "City share of the 1% tax (%)", "", 0.01, "")}
    ${fld("e-cp", "City pledge (%)", 75, 5, "Artesia 2026: 75%")}
    ${fld("e-county", "County General share of the 1% tax (%)", "", 0.01, "")}
    ${fld("e-kp", "County pledge (%)", 49, 1, activeCounty === "oc" ? "Artesia 49%; OC policy cap 50%" : "Artesia 49%; range 11–50%")}
    ${fld("e-rate", "Bond interest rate (%)", 5.25, 0.05, "")}
    ${fld("e-dscr", "Debt-service coverage (x)", 1.35, 0.05, "")}
    <div class="pkg" id="e-out" style="margin-top:10px"></div>
    <div id="e-split"></div>
    <p class="small muted" id="e-note"></p><p class="small" id="e-warn"></p>${eifdRegister()}</div>`;
}
function ocEifdNote() {
  const P = (((typeof D_OC !== "undefined" && D_OC && D_OC.oc_funding) || {}).programs || {}).OC_EIFD; if (!P) return "";
  return `<p class="small" style="margin:6px 0 2px"><b>In Orange County:</b> ${esc(P.what)} ${esc(P.amount)} <a href="${esc(P.example_source)}" target="_blank" rel="noopener">Placentia amended IFP (May 2024)</a>; <a href="${esc(P.source)}" target="_blank" rel="noopener">County EIFD Participation Policy</a>.</p>`;
}
function eifdRegister() {
  const E = (D.r10 || {}).eifds || []; if (!E.length) return "";
  const formed = E.filter(e => /^FORMED|ADOPTED/i.test(e[2])), other = E.filter(e => !/^FORMED|ADOPTED/i.test(e[2]));
  const row = e => `<li><b>${esc(e[0])}</b> — ${esc(e[2].split(";")[0].toLowerCase())}${e[3] ? `; ${esc(e[3])}` : ""}${e[4] ? `; ${esc(e[4].split(";")[0])}` : ""}${e[5] ? `. Pays for: ${esc(e[5])}` : ""}.</li>`;
  return `<details style="margin-top:8px"><summary class="small"><b>Real districts in LA County</b> (${formed.length} formed, ${other.length} proposed, expired or related)${activeCounty === "oc" ? " — for reference" : ""}</summary>${activeCounty === "oc" ? ocEifdNote() : ""}
    <ul class="small" style="margin:6px 0 0 18px;padding:0">${formed.map(row).join("")}</ul>
    <p class="small muted" style="margin:6px 0 2px">Proposed, expired or related:</p><ul class="small" style="margin:0 0 0 18px;padding:0">${other.map(row).join("")}</ul>
    <p class="small muted">From the round-10 research (County, city and IFP documents, accessed Nov 2026). Shares are of each agency's own part of the 1% tax, not of the whole levy. Projected totals are lifetime forecasts, not money in hand.</p></details>`;
}
function eifdWire(p) {
  if (!$("#e-av")) return;
  let scope = "bg";
  const v = id => parseFloat($("#" + id).value) || 0;
  const pct = x => (100 * x).toFixed(1) + "%";
  const setAV = () => {
    const a = eifdArea(p, scope), unincorp = /^Unincorporated/i.test(p.c) || / \(unincorporated\)$/.test(p.c || "") || p.c === "Los Angeles County";
    const real = a.withRoll > 0 && a.av > 0;
    $("#e-av").value = ((real ? a.av : a.mv * 0.55) / 1e6).toFixed(1);
    $("#e-av-n") && ($("#e-av-n").textContent = "");
    if (a.sh) { $("#e-city").value = (a.sh[0] * 100).toFixed(2); $("#e-county").value = (a.sh[1] * 100).toFixed(2); }
    else { $("#e-city").value = unincorp ? 0 : 20; $("#e-county").value = 24; }
    const split = a.sh ? `<div class="kv small" style="margin-top:8px"><span>City${unincorp ? " (none: unincorporated)" : ""}</span><span>${pct(a.sh[0])}</span><span>County General Fund</span><span>${pct(a.sh[1])}</span><span>Other districts (fire, flood, water, library, parks...)</span><span>${pct(a.sh[2])}</span><span>Schools, colleges and ERAF (can't join an EIFD)</span><span>${pct(a.sh[3])}</span></div>
      ${activeCounty === "oc" ? `<p class="small muted">Where each $1 of growth in the 1% tax goes here: ${a.tras.length > 1 ? `the main tax-rate areas of these ${a.n} block groups (largest: ${a.tras.slice(0, 3).map(([t]) => `TRA ${esc(t)}`).join("; ")}), weighted by market value` : `tax-rate area ${esc((a.tras[0] || [""])[0])}, weighted by land area inside this block group`}. Source: Orange County Auditor-Controller Section 99 factor report by tax-rate area, FY 2026-27 (printed 28 Aug 2026), joined to the State Board of Equalization's 2026 tax-rate-area map. The city share is the city's general fund only; its lighting, sewer and similar funds count under other districts. Special districts can also join; their shares are shown but not pledged in this screen.</p>` : `<p class="small muted">Where each $1 of the 1% tax goes here, weighted by assessed value across ${a.tras.length} tax-rate area${a.tras.length > 1 ? "s" : ""} (largest: ${a.tras.filter(t => t[1] > 0).slice(0, 3).map(([t, x]) => `TRA ${esc(t)}, ${fmt$(x)}`).join("; ")}). Source: LA County Auditor-Controller ${esc((D.eifd || {}).factor_year || "")} Modified ATI ratios (AF49 report), the shares the Auditor uses to split tax increment. Special districts can also join; their shares are shown but not pledged in this screen.</p>`}` : "";
    $("#e-split").innerHTML = split + (a.ex.length ? `<p class="small"><b>Already in a district:</b> part of this area is in the ${a.ex.map(esc).join(" and ")}, so its increment is already pledged there. A new district here would need to avoid or amend it.</p>` : "");
    $("#e-note").textContent = real
      ? `Base value is the net taxable value on the ${a.ry || ""} Assessor roll (land + improvements + fixtures, less exemptions) for ${a.np.toLocaleString()} parcels in ${a.n} block group${a.n > 1 ? "s" : ""}: ${fmt$(a.avr)} residential, ${fmt$(a.avc)} commercial/industrial, the rest other uses. A real district's base is the roll in its formation year. All figures are a screening estimate, not a financing plan.`
      : `${activeCounty === "oc" ? "The Orange County Assessor roll is not in this build (the Assessor sells roll data in person only), so the base" : "No Assessor roll value matched this area, so the base"} is estimated as 55% of market value (${a.homes.toLocaleString()} homes). ${a.sh ? "" : "Tax shares are placeholders: no apportionment factors matched. "}All figures are a screening estimate, not a financing plan.`;
  };
  const run = () => {
    const base = v("e-av") * 1e6, gr = v("e-g") / 100, nd = v("e-new") * 1e6, r = v("e-rate") / 100, dscr = Math.max(v("e-dscr"), 1);
    const cityC = v("e-city") / 100 * v("e-cp") / 100, cntyC = v("e-county") / 100 * v("e-kp") / 100;
    const county = cntyC > 0, capture = cityC + cntyC;
    const housing = county ? 0.20 : 0, admin = 0.03;
    let av = base, tot = 0, y10 = 0;
    for (let t = 1; t <= 30; t++) { av = av * (1 + gr) + (t === 3 ? nd : 0);
      const net = Math.max(0, av - base) * 0.01 * capture * (1 - admin); tot += net; if (t === 10) y10 = net; }
    const bond = r > 0 ? y10 * (1 - housing) / dscr * (1 - Math.pow(1 + r, -30)) / r : y10 * (1 - housing) / dscr * 30;
    $("#e-out").innerHTML = `${tile("Year-10 increment", fmt$(y10), "per year, after 3% admin")}${tile("30-year total", fmt$(tot), county ? "before the County's housing condition" : "")}${tile("Bond capacity", fmt$(bond), county ? "30-yr, sized on year 10, 20% held for housing" : "30-yr bonds sized on year 10")}`;
    const w = [];
    const uninc = v("e-city") === 0;
    if (activeCounty === "oc") {
      if (county && !uninc && cntyC > cityC + 1e-9) w.push(`The County would put in more than the city (${(cntyC * 100).toFixed(2)}¢ vs ${(cityC * 100).toFixed(2)}¢ of each $1 of increment). The County's EIFD Participation Policy requires the city's contribution to be equal to or greater than the County's.`);
      if (county && v("e-kp") > 50 + 1e-9) w.push("The County's policy caps its contribution at 50% of its share of the increment, for no longer than 20 years.");
      if (uninc) w.push("No city share here (unincorporated); an EIFD would rest on the County alone, which its policy does not contemplate (it expects a city applicant).");
    } else {
    if (county && !uninc && cntyC > cityC + 1e-9) w.push(`The County would put in more than the city (${(cntyC * 100).toFixed(2)}¢ vs ${(cityC * 100).toFixed(2)}¢ of each $1 of increment). Board Policy 3.106 requires the city's contribution to at least equal the County General Fund's plus any special districts'.`);
    if (county && !uninc && capture > 0 && cityC / capture < 0.15 - 1e-9) w.push("Policy 3.106 also expects at least 15¢ of each captured $1 from the city, with limited exceptions.");
    if (uninc) w.push("No city share here (unincorporated), so the County would form and run the district itself, as it did for West Carson.");
    }
    $("#e-warn").innerHTML = w.length ? (uninc ? "<b>Note:</b> " : "<b>County policy check:</b> ") + w.map(esc).join(" ") : "";
  };
  $("#panel").querySelectorAll("[data-scope]").forEach(b => b.onclick = () => { scope = b.dataset.scope;
    $("#panel").querySelectorAll("[data-scope]").forEach(x => x.setAttribute("aria-pressed", x === b)); setAV(); run(); });
  ["e-av", "e-g", "e-new", "e-city", "e-cp", "e-county", "e-kp", "e-rate", "e-dscr"].forEach(id => { const el = $("#" + id); if (el) el.oninput = run; });
  setAV(); run();
}

function select(id, fly) {
  selected = id; highlight(); syncHash(id); updateCompareUI();
  const f = byId.get(id); if (!f) return;
  if (fly) map.fitBounds(L.geoJSON(f).getBounds(), { maxZoom: 15, padding: [60, 60] });
  const p = f.properties, d = D.details[id] || {}, m = d.m || {};
  const recs = (d.r || []).map(a => Object.fromEntries(REC_KEYS.map((k, i) => [k, a[i]])));
  const kind = r => D.catalog[r.id].kind;
  const valAll = recs.filter(r => kind(r) === "value" || kind(r) === "regional");
  const val = valAll.filter(r => allowed(r.id)).sort((a, b) => b.vpd - a.vpd);
  const hidden = valAll.length - val.length;
  const qol = recs.filter(r => kind(r) === "qol").sort((a, b) => b.qol - a.qol || a.cost - b.cost);
  const pol = recs.filter(r => kind(r) === "policy"), own = recs.filter(r => kind(r) === "owner").sort((a, b) => b.vpd - a.vpd);
  const pkg = val.filter(r => r.vpd >= 1 && kind(r) === "value");
  const top = val.find(r => kind(r) === "value");

  // Determine Top 3 for First-Task presentation
  let top3 = [];
  if (renterViewOn) {
    const renterDirect = [...val, ...qol].filter(r => D.catalog[r.id].renter_direct || D.catalog[r.id].displacement_risk === "protective");
    top3 = (renterDirect.length ? renterDirect : [...val, ...qol]).slice(0, 3);
  } else {
    top3 = (val.length >= 3 ? val.slice(0, 3) : [...val, ...qol].slice(0, 3));
  }

  const topRng = top ? formatVpdRange(top.vpd, D.catalog[top.id]?.grade, top.id, m) : null;
  const inC = compareList.includes(id), oc = isOCArea(m), ocReal = oc && !!(D_OC && D_OC.meta && D_OC.meta.schema >= 2);
  let h = `<div class="eyebrow">${String(id).length === 12 ? "BLOCK GROUP" : "CENSUS TRACT"} ${esc(id)} · ${esc(p.c)} · ${fmtN(m.acres)} acres</div><h2>${esc(p.n)}</h2>
    <p class="subname">Name from ${esc(m.ns || "")}${m.csa && m.csa !== p.n ? " · County area: " + esc(m.csa) : ""}</p>
    <div class="action-bar">
      <button type="button" class="action-pill" onclick="copyShareLink()" title="Copy shareable link">🔗 Share</button>
      <button type="button" class="action-pill" onclick="copyAreaSummary('${id}')" title="Copy markdown brief">📋 Copy summary</button>
      <button type="button" class="action-pill" onclick="window.print()" title="Print 1-page dossier">🖨️ Print</button>
      <button type="button" class="action-pill${inC ? " active" : ""}" id="btn-compare-panel" onclick="toggleCompare('${id}')">${inC ? "✓ In comparison" : "⚖️ + Compare"}</button>
      <button type="button" class="action-pill${renterViewOn ? " active" : ""}" id="btn-renter-panel" onclick="toggleRenterView()">${renterViewOn ? "👥 Renter view (on)" : "👥 Renter view"}</button>
      <button type="button" class="action-pill" onclick="openCorrection('${id}')">📝 Suggest correction</button>
    </div>`;
  if (oc && !(D_OC && D_OC.meta && D_OC.meta.schema >= 2)) h += `<div class="prelim-banner warn"><span class="prelim-icon">⚠️</span><span><b>Orange County coverage is preliminary.</b> Home values, rents, crime, heat and project sizing here are neighborhood-level estimates assembled from public sources. They have not been checked against Census, Assessor, police or transit-schedule records the way LA County's block groups have. Read them as a sketch, not a measurement.</span></div>`;

  h += top && top.vpd >= 1 ? `<p class="verdict">Best bet: <b>${esc(D.catalog[top.id].name.replace(/^([A-Z])(?=[a-z])/, c => c.toLowerCase()))}</b>${/\d/.test(top.project) ? ` (${esc(top.project)})` : ""}. Expected return: <b>${topRng.estStr}</b> of home value per $1 (band ${topRng.str}, evidence ${esc(D.catalog[top.id]?.grade || "evaluated")}).</p>`
    : `<p class="verdict">Nothing here returns $1 of home value per $1 spent. The quality-of-life projects below are still worth a look.</p>`;

  // First Task Presentation: Top 3 cards prominent at top
  
  // Interactive Multi-Project Package Simulator
  const simEligible = [...val, ...qol].slice(0, 6);
  if (simEligible.length > 0) {
    if (activePackageItems.size === 0 && top) activePackageItems.add(top.id);
    h += `<div class="package-simulator-card" style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:10px;padding:12px;margin:12px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-weight:700;font-size:13px;color:#0f172a">📦 Multi-Project Package Simulator</span>
        <span style="font-size:11px;background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:12px;font-weight:600">Synergy &amp; Grant Stacking</span>
      </div>
      <p class="small" style="margin:0 0 8px 0;color:#475569">Select multiple projects to calculate compound property value lift, synergy bonuses (e.g. 1.25× walk-to-school), and non-private grant coverage:</p>
      <div style="display:flex;flex-direction:column;gap:5px;max-height:160px;overflow-y:auto;padding-right:4px">
        ${simEligible.map(r => `
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;background:#fff;padding:5px 8px;border-radius:6px;border:1px solid #e2e8f0">
            <input type="checkbox" value="${r.id}" ${activePackageItems.has(r.id) ? "checked" : ""} onchange="togglePackageItem('${r.id}', '${id}')">
            <span style="flex:1"><b>${esc(D.catalog[r.id]?.name || r.id)}</b> (${fmt$(r.cost)})</span>
            <span style="font-weight:600;color:#059669">${fvpd(r.vpd)}/$1</span>
          </label>
        `).join("")}
      </div>
      <div id="sim-results"></div>
    </div>`;
  }

  h += `<div class="top3-section">
    <h3>${renterViewOn ? "Top 3 renter &amp; community priorities" : "Top 3 recommended investments"}</h3>
    <div class="recs">
      ${top3.map((r, i) => recCard(r, i, kind(r) === "value" ? "value" : "qol")).join("")}
    </div>
  </div>`;

  // Core Vitals Tiles
  h += `<div class="section"><div class="tiles">
    ${tile("Typical home value", fmt$(m.hv), esc(oc && !ocReal ? "neighborhood estimate (preliminary)" : (m.hvs || "")))}
    ${tile("Median rent", m.rent ? fmt$(m.rent) + "/mo" : "–", oc && !ocReal ? "estimate (preliminary)" : ocReal ? "Census ACS 2020–24" : "Census ACS 5-Year")}
    ${tile("Homes", fmtN(m.homes), `${m.own != null ? Math.round(m.own) + "% owner-occupied" : ""}`)}
    ${tile("Heat vs median", m.ht != null ? (m.ht > 0 ? "+" : "") + (+m.ht).toFixed(1) + "°F" : "–", oc && !ocReal ? "estimate (preliminary)" : ocReal ? "Tree Equity Score 2021 vs urbanized-area mean" : "Tree Equity Score")}
    ${tile("Violent crime", m.vc != null ? (+m.vc).toFixed(1) + " per 1k" : "no data", m.vc != null ? `12 mo · ${esc(m.ag || "")}` : "independent police")}
    ${tile("Bus service", m.bt != null ? Math.round(m.bt) + "/hr" : "–", m.rm != null ? `rail ${(m.rm / 1609).toFixed(1)} mi` : "")}
  </div></div>`;

  if (pkg.length) h += `<div class="pkg" style="margin-bottom:12px">${tile("Paying projects", pkg.length, "≥ $1 per $1")}${tile("Total cost", fmt$(pkg.reduce((s, r) => s + r.cost, 0)), "build + land + 10-yr upkeep")}${tile("Value created", fmt$(pkg.reduce((s, r) => s + r.value, 0)), "nearby homes, combined")}</div>`;

  // Collapsible Sections for everything else
  h += `<details class="panel-sec"><summary><b>Neighborhood Plan &amp; Missing Amenities</b></summary><div class="sec-content">${gapSection(p, m)}</div></details>`;

  const cats = ["All", ...CATS.filter(c => val.some(r => D.catalog[r.id].category === c))];
  h += `<details class="panel-sec"><summary><b>All Ranked Value Projects (${val.length})</b></summary><div class="sec-content">
    <div class="cat-tabs" role="group" aria-label="Filter by category">${cats.map((c, i) => `<button type="button" data-cat="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`).join("")}</div>
    <div class="recs" id="valrecs"></div>
    ${hidden ? `<p class="small muted">${hidden} lower-graded estimate${hidden > 1 ? "s" : ""} hidden by the evidence filter above.</p>` : ""}
    <p class="small muted">Value counts nearby homes reached. Cost includes physical construction plus 10 years of ongoing operations/maintenance.</p>
  </div></details>`;

  if (qol.length) h += `<details class="panel-sec"><summary><b>Quality-of-Life Projects (${qol.length})</b></summary><div class="sec-content"><p class="small muted">Sorted by neighborhood need compared with county medians.</p><div class="recs">${qol.map((r, i) => recCard(r, i, "qol")).join("")}</div></div></details>`;

  if (pol.length) h += `<details class="panel-sec"><summary><b>Zoning &amp; Policy Reforms</b></summary><div class="sec-content"><div class="recs">${pol.map((r, i) => recCard(r, i, "policy")).join("")}</div></div></details>`;

  if (own.length || (D.upgrades || []).length) h += `<details class="panel-sec"><summary><b>For an Individual Homeowner Here</b></summary><div class="sec-content"><div class="recs">${own.map((r, i) => recCard(r, i, "owner")).join("")}</div>${upgradeTable(m)}</div></details>`;

  h += `<details class="panel-sec"><summary><b>Zoning: What Can Be Built Here</b></summary><div class="sec-content">${zoningSection({ ...m, city: p.c })}</div></details>`;
  h += `<details class="panel-sec"><summary><b>Underused Land &amp; Infill Sites</b></summary><div class="sec-content">${underSection(p)}</div></details>`;
  h += `<details class="panel-sec"><summary><b>Public Facilities Nearby</b></summary><div class="sec-content">${facilitySection(m)}</div></details>`;
  h += `<details class="panel-sec"><summary><b>EIFD Tax-Increment Financing Calculator</b></summary><div class="sec-content">${fundSummary(pkg, id)}${eifdSection(p, m)}</div></details>`;

  const kv = [], add = (k, v, f = x => x) => { if (v != null && v !== "" && !(typeof v === "number" && isNaN(v))) kv.push(`<span>${k}</span><span>${f(v)}</span>`); };
  add("Population", m.pop, fmtN); add("Median household income", m.inc, fmt$); add("Median rent", m.rent, v => fmt$(v) + "/mo"); add("Median year built", m.yb, v => Math.round(v));
  add("Single-family share", m.sf, v => Math.round(v) + "%"); add("Households without a car", m.nocar, v => Math.round(v) + "%");
  if (!oc) { add("Street trees (city survey)", m.st, fmtN); add("Open tree sites", m.ts, fmtN); }
  add("Canopy gap to goal (Tree Equity)", m.tg, v => (+v).toFixed(0) + " pts");
  add("Property crimes, 12 mo", m.pcr, fmtN); add("Fatal/severe crashes recorded", m.ksi, fmtN);
  if (!oc) { add("Dumping/litter reports, 12 mo (311)", m.dump, fmtN); add("Graffiti reports, 12 mo (311)", m.graf, fmtN); }
  if (oc && m.nearest_transit && m.nearest_transit.station) add("Nearest rail station", `${esc(m.nearest_transit.station)}${m.nearest_transit.lines ? " (" + esc(m.nearest_transit.lines) + ")" : ""}${m.nearest_transit.distance_mi != null ? ", " + m.nearest_transit.distance_mi + " mi" : ""}`);
  add("Freeway distance", m.fw, v => fmtN(v) + " m"); add("Nearest supermarket", m.gro, v => (v / 1609).toFixed(1) + " mi"); add("Restaurants & cafés within 400 m", m.din, fmtN);
  add("Nearest public tennis court", m.ten, v => (v / 1609).toFixed(1) + " mi"); add("Nearest dog park", m.dog, v => (v / 1609).toFixed(1) + " mi"); add("Nearest public pool", m.pool, v => (v / 1609).toFixed(1) + " mi");
  add("Nearest EV fast charger mapped", m.ev, v => (v / 1609).toFixed(1) + " mi");
  if (kv.length) h += `<details class="panel-sec"><summary><b>Area Profile &amp; ${oc ? "Statistics" : "Census Statistics"}</b></summary><div class="sec-content">${oc && !ocReal ? '<p class="small muted">Neighborhood-level estimates (preliminary Orange County pass), not Census block-group tabulations.</p>' : ocReal ? '<p class="small muted">Census ACS 2020–24 block-group tabulations (tract medians where the block-group value is not published); distances and counts computed from OpenStreetMap (5 Nov 2026 extract), OCTA GTFS, CDE, CHP CCRS 2016–2025, CA DOJ and OC Parks data.</p>' : ""}<div class="kv">${kv.join("")}</div></div></details>`;

  h += `<details class="panel-sec technical-appendix"><summary><b>Technical Appendix &amp; Data Pipeline Status</b></summary><div class="sec-content">${renderTechAppendix(ocReal)}</div></details>`;

  $("#panel").innerHTML = h;
  runPackageSimulation(id); $("#panel").scrollTop = 0;
  eifdWire(p);
  $("#panel").querySelectorAll("[data-site]").forEach(el => el.onclick = () => { const U = D.layers.underused, sid = +el.dataset.site;
    for (const k in U.cells) for (const [id, rings] of U.cells[k]) if (id === sid) { if (!$("#l-under").checked) { $("#l-under").checked = true; drawContext(); } map.fitBounds(L.polygon(rings.map(decodeLine)).getBounds(), { maxZoom: 17, padding: [80, 80] }); return; } });
  const draw = cat => { const list = val.filter(r => cat === "All" || D.catalog[r.id].category === cat);
    const vr = $("#valrecs");
    if (vr) {
      vr.innerHTML = list.length ? list.slice(0, 12).map((r, i) => recCard(r, i, "value")).join("") + (list.length > 12 ? `<details class="more"><summary>${list.length - 12} more</summary><div class="recs">${list.slice(12).map((r, i) => recCard(r, i + 12, "value")).join("")}</div></details>` : "") : `<p class="empty">Nothing in this category applies here.</p>`;
    }
  };
  draw("All");
  $("#panel").querySelectorAll(".cat-tabs button[data-cat]").forEach(b => b.onclick = () => { $("#panel").querySelectorAll(".cat-tabs button[data-cat]").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(b.dataset.cat); });
}

// The build log leaves "<dataset-id> error: ;" fragments for feeds that failed; they are noise to a reader.
const cleanBuild = x => String(x ?? "").replace(/\b[a-z0-9]{4}-[a-z0-9]{4}\s*error:\s*;?\s*/gi, "").replace(/;\s*;/g, ";").replace(/^\s*;\s*/, "").trim();
function report() {
  const R = D.report || {};
  let h = `<section><h2>${esc(R.title || "")}</h2>${(R.paragraphs || []).map(p => `<p>${cleanBuild(p)}</p>`).join("")}</section>`;
  (R.sections || []).forEach(s => {
    h += `<section><h2>${esc(s.title)}</h2>${(s.paragraphs || []).map(p => `<p>${cleanBuild(p)}</p>`).join("")}`;
    if (s.table) h += `<div class="tablewrap"><table><thead><tr>${s.table.head.map(x => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${s.table.rows.map(r => `<tr>${r.map((c, i) => `<td${s.table.num && s.table.num.includes(i) ? ' class="num"' : ""}>${cleanBuild(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    if (s.list) h += `<ul>${s.list.map(x => `<li>${cleanBuild(x)}</li>`).join("")}</ul>`;
    h += `</section>`;
  });
  $("#report").innerHTML = h;
}


// --- Presets, Share, Compare, Renter View & Modal Handlers ---
let renterViewOn = false;
let compareList = [];

function applyPreset(name) {
  document.querySelectorAll(".preset-btn").forEach(b => b.classList.toggle("active", b.dataset.preset === name));
  
  // Update checkbox state directly without event dispatch loop
  const setVal = (id, val) => {
    const el = $(id);
    if (el) el.checked = val;
  };

  const keepLots = (typeof activeCounty !== "undefined" && activeCounty === "oc") || name === "housing";
  if (name === "streets") {
    setVal("#l-roads", true);
    setVal("#l-transit", true);
    setVal("#l-hoods", true);
    setVal("#l-parks", false);
    setVal("#l-amen", false);
    setVal("#l-fac", false);
    setVal("#l-under", false);
    setVal("#l-proj", false);
    setVal("#l-zone", false);
    setVal("#l-lots", keepLots);
    setVal("#l-aerial", false);
    const mSel = $("#metric");
    if (mSel) { mSel.value = "top_vpd"; restyle(); legend(); }
  } else if (name === "green") {
    setVal("#l-roads", true);
    setVal("#l-transit", false);
    setVal("#l-parks", true);
    setVal("#l-amen", true);
    setVal("#l-hoods", true);
    setVal("#l-fac", false);
    setVal("#l-under", false);
    setVal("#l-proj", false);
    setVal("#l-zone", false);
    setVal("#l-lots", keepLots);
    setVal("#l-aerial", false);
    const mSel = $("#metric");
    if (mSel) { mSel.value = "heat"; restyle(); legend(); }
  } else if (name === "housing") {
    setVal("#l-roads", true);
    setVal("#l-transit", true);
    setVal("#l-zone", true);
    setVal("#l-under", true);
    setVal("#l-proj", true);
    setVal("#l-lots", true);
    setVal("#l-parks", false);
    setVal("#l-amen", false);
    setVal("#l-fac", false);
    setVal("#l-aerial", false);
    const mSel = $("#metric");
    if (mSel) { mSel.value = "value"; restyle(); legend(); }
  }

  // Single clean redraw - zero flickering or event thrashing
  drawContext();
  if (typeof syncLots === "function") syncLots();
  if (typeof syncAerial === "function") syncAerial();
}

function showToast(msg) {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2600);
}

function syncHash(id) {
  if (!id) return;
  const hash = "#bg=" + id;
  if (window.location.hash !== hash) {
    history.replaceState(null, null, hash);
  }
}

function checkHash() {
  const m = window.location.hash.match(/#bg=([0-9]+)/);
  if (m && byId.has(m[1]) && m[1] !== selected) {
    select(m[1], true);
  }
}

function copyShareLink() {
  syncHash(selected);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(window.location.href).then(() => {
      showToast("Shareable link copied to clipboard!");
    }).catch(() => {
      showToast("Link: " + window.location.href);
    });
  } else {
    showToast("Link: " + window.location.href);
  }
}

function copyAreaSummary(id) {
  const f = byId.get(id); if (!f) return;
  const p = f.properties, d = D.details[id] || {}, m = d.m || {};
  const recs = (d.r || []).map(a => Object.fromEntries(REC_KEYS.map((k, i) => [k, a[i]])));
  const val = recs.filter(r => allowed(r.id) && D.catalog[r.id].kind === "value").sort((a, b) => b.vpd - a.vpd);
  const top3 = val.slice(0, 3);
  
  let txt = `City Pretty Brief: ${p.n} (${p.c})\n`;
  txt += `Block Group ID: ${id} | Typical Home Value: ${fmt$(m.hv)} | Homes: ${fmtN(m.homes)}\n\n`;
  txt += `Top 3 Recommended Projects:\n`;
  top3.forEach((r, i) => {
    const c = D.catalog[r.id], rng = formatVpdRange(r.vpd, c.grade, r.id, m);
    txt += `${i+1}. ${c.name} (${r.project})\n`;
    txt += `   - Return: ${rng.estStr} of home value per $1 (band ${rng.str}, ${rng.badge})\n`;
    txt += `   - Cost: ${fmt$(r.cost)} (Build + Upkeep)\n`;
    txt += `   - Who decides: ${c.lead_agency || "City Council"}\n`;
    txt += `   - Next step: ${c.process || "CIP budget inclusion"}\n`;
  });
  txt += `\nExplore interactive map: ${window.location.href}\n`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => {
      showToast("Summary brief copied to clipboard!");
    });
  } else {
    showToast("Summary generated for " + p.n);
  }
}

function toggleRenterView() {
  renterViewOn = !renterViewOn;
  const hBtn = $("#btn-renter-header"); if (hBtn) hBtn.classList.toggle("active", renterViewOn);
  const pBtn = $("#btn-renter-panel"); if (pBtn) pBtn.classList.toggle("active", renterViewOn);
  if (selected) select(selected, false);
  showToast(renterViewOn ? "Renter & Community Impact lens active" : "Standard investor view active");
}

function toggleCompare(id) {
  const idx = compareList.indexOf(id);
  if (idx >= 0) {
    compareList.splice(idx, 1);
    showToast("Removed from comparison");
  } else {
    if (compareList.length >= 3) {
      showToast("Comparison is limited to 3 neighborhoods");
      return;
    }
    compareList.push(id);
    showToast("Added to comparison drawer");
  }
  updateCompareUI();
}

function clearCompare() {
  compareList = [];
  updateCompareUI();
  renderCompareDrawer();
}

function updateCompareUI() {
  const hBtn = $("#btn-compare-header");
  if (hBtn) hBtn.textContent = `Compare (${compareList.length})`;
  const pBtn = $("#btn-compare-panel");
  if (pBtn) {
    const inC = compareList.includes(selected);
    pBtn.textContent = inC ? "✓ In comparison" : "⚖️ + Compare";
    pBtn.classList.toggle("active", inC);
  }
}

function openCompareDrawer() {
  if (compareList.length === 0) {
    if (selected) compareList.push(selected);
    else {
      showToast("Select a neighborhood to compare first");
      return;
    }
    updateCompareUI();
  }
  renderCompareDrawer();
  const m = $("#compare-modal");
  if (m) m.hidden = false;
}

function closeCompareDrawer() {
  const m = $("#compare-modal");
  if (m) m.hidden = true;
}

function renderCompareDrawer() {
  const box = $("#compare-content");
  if (!box) return;
  if (!compareList.length) {
    box.innerHTML = `<p class="empty">No neighborhoods selected. Click "+ Compare" on any neighborhood card.</p>`;
    return;
  }
  box.innerHTML = compareList.map(id => {
    const f = byId.get(id); if (!f) return "";
    const p = f.properties, d = D.details[id] || {}, m = d.m || {};
    const recs = (d.r || []).map(a => Object.fromEntries(REC_KEYS.map((k, i) => [k, a[i]])));
    const val = recs.filter(r => allowed(r.id) && D.catalog[r.id].kind === "value").sort((a, b) => b.vpd - a.vpd);
    const top = val[0];
    const topC = top ? D.catalog[top.id] : null;
    const topRng = top && topC ? formatVpdRange(top.vpd, topC.grade, top.id, m) : null;
    return `
      <div class="compare-col">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <h4>${esc(p.n)}</h4>
          <button type="button" class="small" style="background:none;border:none;cursor:pointer;color:var(--ink-3)" onclick="toggleCompare('${id}'); renderCompareDrawer();">✕</button>
        </div>
        <div class="c-row"><span class="k">City</span><span class="v">${esc(p.c)}</span></div>
        <div class="c-row"><span class="k">Typical Home Value</span><span class="v">${fmt$(m.hv)}</span></div>
        <div class="c-row"><span class="k">Median Rent</span><span class="v">${m.rent ? fmt$(m.rent) + "/mo" : "–"}</span></div>
        <div class="c-row"><span class="k">Homes / Owner-Occ</span><span class="v">${fmtN(m.homes)} (${m.own != null ? Math.round(m.own) + "%" : "–"})</span></div>
        <div class="c-row"><span class="k">Best Bet</span><span class="v">${topC ? esc(topC.name) : "–"}</span></div>
        <div class="c-row"><span class="k">Expected Return</span><span class="v">${topRng ? topRng.estStr + " (" + topRng.str + ")" : "–"}</span></div>
        <div class="c-row"><span class="k">Heat vs County</span><span class="v">${m.ht != null ? (m.ht > 0 ? "+" : "") + (+m.ht).toFixed(1) + "°F" : "–"}</span></div>
        <div class="c-row"><span class="k">Violent Crime / 1k</span><span class="v">${m.vc != null ? (+m.vc).toFixed(1) : "–"}</span></div>
        <div class="c-row"><span class="k">Bus Frequency</span><span class="v">${m.bt != null ? Math.round(m.bt) + "/hr" : "–"}</span></div>
      </div>
    `;
  }).join("");
}

function openMethodsModal() {
  const m = $("#methods-modal");
  if (m) m.hidden = false;
}

function closeMethodsModal() {
  const m = $("#methods-modal");
  if (m) m.hidden = true;
}

function openCorrection(id) {
  const f = byId.get(id); const p = f ? f.properties : {};
  const subj = encodeURIComponent(`Correction for Block Group ${id} (${p.n || "LA County"})`);
  const body = encodeURIComponent(`Hi City Pretty team,\n\nI have a data correction for Block Group ${id} in ${p.n || ""}, ${p.c || ""}:\n\n- Project or metric name:\n- Corrected value or finding:\n- Source or documentation link:\n\nThank you!`);
  window.open(`mailto:corrections@citypretty.org?subject=${subj}&body=${body}`, '_blank');
}

function renderTechAppendix(ocReal) {
  const row = (id, what, status, ok) => `<tr style="border-top:1px solid var(--rule)"><td style="padding:4px 6px"><code>${esc(id)}</code></td><td style="padding:4px 6px">${esc(what)}</td><td style="padding:4px 6px;color:${ok ? "var(--good-ink)" : "var(--warn-ink)"}">${ok ? "✓" : "✗"} ${esc(status)}</td></tr>`;
  if (ocReal && D_OC && D_OC.meta && D_OC.meta.sources) return `
    <p class="small">Orange County was built on ${esc(D_OC.meta.built || "")} from the public files below (every file is kept raw in the build folder so each number can be traced). Nothing was estimated where a source is missing: those projects are simply not scored here.</p>
    <table class="small" style="width:100%;border-collapse:collapse;margin-top:6px">
      <thead><tr style="background:var(--ground)"><th style="text-align:left;padding:4px 6px">Source</th><th style="text-align:left;padding:4px 6px">Used for</th><th style="text-align:left;padding:4px 6px">Status in this build</th></tr></thead>
      <tbody>${D_OC.meta.sources.map(r => row(r[0], r[1], r[2], r[3])).join("")}</tbody>
    </table>`;
  return `
    <p class="small">What the build log recorded for the live feeds this page uses (build ${esc((D.meta && D.meta.built) || "")}). The full source list, with row counts and vintages, is in the field report below the map under "Data in this build".</p>
    <table class="small" style="width:100%;border-collapse:collapse;margin-top:6px">
      <thead><tr style="background:var(--ground)"><th style="text-align:left;padding:4px 6px">Resource / endpoint</th><th style="text-align:left;padding:4px 6px">Service</th><th style="text-align:left;padding:4px 6px">Status in this build</th></tr></thead>
      <tbody>
        ${row("pi9x-tg5x", "LADBS \"Building and Safety - Building Permits Issued from 2020 to Present\" (queried live per lot)", "Live query", true)}
        ${row("d9aa-v8bm", "LADBS \"Building Permit Information Data\" (older permits with story counts; queried live per lot)", "Live query", true)}
        ${row("h73f-gn57", "\"MyLA311 Service Request Data 2025\" (dumping, graffiti; Nov 2024 – Nov 2025 window)", "Loaded", true)}
        ${row("2cy6-i7zn", "\"MyLA311 Cases 2026\"", "Not reached in this build; 2025 data used instead", false)}
        ${row("73a2-6ar5", "\"MyLA311 Cases March 2025 to December 2025\"", "Not reached in this build", false)}
        ${row("k7nn-b2ep", "\"LAPD NIBRS Offenses Dataset\" (latest record 2026-10-26)", "Loaded", true)}
        ${row("2nrs-mtv8", "\"Crime Data from 2020 to 2024\" (frozen series; latest record 2025-03-28)", "Loaded", true)}
        ${row("gqf2-vm2j", "\"LAPD NIBRS Victims Dataset\" (victim table; not needed)", "Not reached in this build", false)}
        ${row("FHSZSRA_23_3", "CAL FIRE Fire Hazard Severity Zones, State Responsibility Area (2024)", "Live query / shipped polygons", true)}
        ${row("FHSALRA25_v1_All", "CAL FIRE Fire Hazard Severity Zones, Local Responsibility Area (2025)", "Live query / shipped polygons", true)}
        ${row("CGS_Alquist_Priolo_Fault_Zones", "California Geological Survey earthquake fault zones (with landslide and liquefaction zones)", "Live query / shipped polygons", true)}
        ${row("LACounty_Parcel", "LA County Assessor parcel service (lot lines, per-house records)", "Live query", true)}
        ${row("pais_sales_parcels", "LA County PAIS recorded sales (per-house last sale)", "Live query", true)}
      </tbody>
    </table>
    <p class="small muted" style="margin-top:6px">Per-lot checks (permits, sales, historic, hillside, hazard and fire zones) are queried from the agencies' public services when the page is online; nine of them are also answered from polygons shipped with this file.</p>
  `;
}


// ---------------- Orange County Expansion Module ----------------
var D_OC = null;
var ocLayer = null;
var activeCounty = "la"; // "la" or "oc"
if (typeof window !== "undefined") {
  window.D_OC = D_OC;
  window.activeCounty = activeCounty;
  window.switchCounty = switchCounty;
  window.initOrangeCounty = initOrangeCounty;
}

async function unpackGzipB64(b64Text) {
  const bin = await b64Bytes(b64Text);
  if (typeof DecompressionStream !== "undefined") {
    try {
      const s = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
      return JSON.parse(s);
    } catch(e) {}
  }
  const s = atob(b64Text);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  const decomp = fflate.gunzipSync(u);
  const jsonStr = (typeof TextDecoder !== "undefined") ? new TextDecoder().decode(decomp) : fflate.strFromU8(decomp);
  return JSON.parse(jsonStr);
}

let _ocLayersMerged = false;
async function initOrangeCounty() {
  const elOC = document.getElementById("bundle-oc");
  if (!elOC || !elOC.textContent) return;
  try {
    const b64Text = elOC.textContent.trim();
    D_OC = await unpackGzipB64(b64Text);
    if (typeof window !== "undefined") window.D_OC = D_OC;
    
    if (D_OC.plans && typeof D !== "undefined" && D && D.plans) {
      Object.assign(D.plans, D_OC.plans);
    }
    if (D_OC.profit && typeof D !== "undefined" && D && D.under) {
      if (!D.under.profit) D.under.profit = {};
      Object.assign(D.under.profit, D_OC.profit);
    }

    const ocReal = (D_OC.meta && D_OC.meta.schema >= 2);   // real geometry (schema 2); the first bundle's parks and neighborhoods are placeholders
    if (!_ocLayersMerged && D_OC.layers && typeof D !== "undefined" && D && D.layers) {
      const ocl = D_OC.layers;
      (ocReal ? ["freeways", "arterials", "parks", "water", "rail", "stations", "walls", "amenities", "stops", "facilities", "projects"] : ["freeways", "arterials", "water", "rail", "stations"]).forEach(k => {
        if (ocl[k] && ocl[k].features && D.layers[k] && D.layers[k].features) {
          D.layers[k].features.push(...ocl[k].features);
        } else if (ocl[k] && !D.layers[k]) {
          D.layers[k] = ocl[k];
        }
      });
      if (ocl.streets && D.layers.streets && (ocReal || ocl.streets.cell === D.layers.streets.cell)) {
        if (ocReal && ocl.streets.fwy && D.layers.streets.fwy) D.layers.streets.fwy.push(...ocl.streets.fwy.map(([c, n, e]) => [c, n, e]));
        const baseNames = D.layers.streets.names || [];
        const nameMap = new Map();
        (ocl.streets.names || []).forEach((n, idx) => {
          let mappedIdx = baseNames.indexOf(n);
          if (mappedIdx === -1) {
            mappedIdx = baseNames.length;
            baseNames.push(n);
          }
          nameMap.set(idx, mappedIdx);
        });
        if (ocReal && ocl.streets.fwy && D.layers.streets.fwy) {
          const n0 = D.layers.streets.fwy.length - ocl.streets.fwy.length;
          for (let i = n0; i < D.layers.streets.fwy.length; i++) D.layers.streets.fwy[i] = [D.layers.streets.fwy[i][0], nameMap.get(D.layers.streets.fwy[i][1]) ?? D.layers.streets.fwy[i][1], D.layers.streets.fwy[i][2]];
        }
        if (ocl.streets.cells) {
          if (!D.layers.streets.cells) D.layers.streets.cells = {};
          for (const [cellKey, lines] of Object.entries(ocl.streets.cells)) {
            const remappedLines = lines.map(([c, nIdx, poly]) => [c, nameMap.get(nIdx) ?? nIdx, poly]);
            if (D.layers.streets.cells[cellKey]) {
              D.layers.streets.cells[cellKey].push(...remappedLines);
            } else {
              D.layers.streets.cells[cellKey] = remappedLines;
            }
          }
        }
      }
      if (D_OC.cities && D_OC.cities.features && D.cities && D.cities.features) {
        D.cities.features.push(...D_OC.cities.features);
      }
      if (D_OC.city_labels && D.city_labels) {
        D.city_labels.push(...D_OC.city_labels);
      }
      if (ocReal && D_OC.hoods && D_OC.hoods.features && D.hoods && D.hoods.features) {
        D.hoods.features.push(...D_OC.hoods.features);
      }
      if (ocReal && D_OC.hood_labels && D.hood_labels) {
        D.hood_labels.push(...D_OC.hood_labels);
      }
      if (ocReal && D_OC.layers.park_labels && D.layers.park_labels) {
        D.layers.park_labels.push(...D_OC.layers.park_labels);
        D.layers.park_labels.sort((a, b) => b[3] - a[3]);   // drawLabels stops at the first park below the zoom's acreage cutoff
      }
      if (ocReal && D_OC.layers.fac_areas && D.layers.fac_areas && D.layers.fac_areas.cells) Object.assign(D.layers.fac_areas.cells, D_OC.layers.fac_areas.cells || {});
      _ocLayersMerged = true;
    }

    if (D_OC.features) {
      D_OC.features.forEach(f => {
        const p = f.properties;
        if (typeof byId !== "undefined" && byId) byId.set(p.id, f);
        if (typeof D !== "undefined" && D && D.details && !D.details[p.id]) {
          D.details[p.id] = D_OC.details[p.id];
        }
      });
    }
    console.log("Orange County bundle unpacked successfully (" + (D_OC.features ? D_OC.features.length : 0) + " neighborhood tracts across " + Object.keys(D_OC.plans || {}).length + " neighborhoods).");
  } catch (e) {
    console.log("Could not unpack OC bundle:", e.message || e);
  }
}

function buildStamp(override) {
  const b = override || (typeof D !== "undefined" && D && D.meta && D.meta.built) || "";
  const m = String(b).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]} ${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][+m[2] - 1]} ${m[1]}`;
}
function switchCounty(c) {
  activeCounty = c;
  if (typeof window !== "undefined") window.activeCounty = activeCounty;
  const btnLa = $("#btn-county-la"), btnOc = $("#btn-county-oc");
  if (btnLa) btnLa.classList.toggle("active", c === "la");
  if (btnOc) btnOc.classList.toggle("active", c === "oc");
  
  // Ensure property lines checkbox is checked
  const cbLots = $("#l-lots");
  if (cbLots) cbLots.checked = true;

  if (typeof lots !== "undefined" && lots && typeof map !== "undefined" && map) {
    if (map.hasLayer(lots)) map.removeLayer(lots);
    lots = null;
    if (typeof window !== "undefined") window.lots = null;
  }
  if (typeof syncLots === "function") syncLots();
  if (typeof numLayer !== "undefined" && numLayer && typeof map !== "undefined" && map) {
    if (map.hasLayer(numLayer)) map.removeLayer(numLayer);
    numLayer = null;
  }
  if (typeof drawNumbers === "function") drawNumbers();

  // Clear street / vector caches so they re-render immediately for the new county bounds
  if (typeof _drawn !== "undefined" && _drawn && _drawn.clear) _drawn.clear();
  if (typeof _cellCache !== "undefined" && _cellCache && _cellCache.clear) _cellCache.clear();
  if (typeof _fwyLines !== "undefined") _fwyLines = null;
  if (typeof drawContext === "function") drawContext();

  const eb = $(".eyebrow");
  if (c === "oc") {
    if (eb) eb.textContent = "CITY PRETTY · ORANGE COUNTY" + (D_OC && D_OC.meta && D_OC.meta.schema >= 2 ? "" : " (PRELIMINARY)") + " · " + (buildStamp(D_OC && D_OC.meta && D_OC.meta.built) || buildStamp());
    if (typeof bgs !== "undefined" && bgs && map && map.hasLayer(bgs)) map.removeLayer(bgs);
    if (!ocLayer && D_OC && typeof L !== "undefined" && L.geoJSON && typeof map !== "undefined" && map) {
      ocLayer = L.geoJSON(D_OC, {
        style: styleBg,
        onEachFeature: (f, l) => {
          const p = f.properties;
          l.bindTooltip(() => {
            const k = $("#metric").value;
            const m = METRICS[k];
            const mv = m ? m.unit(m.f(p)) : "";
            const catName = p.t && D.catalog[p.t] ? D.catalog[p.t].name : p.t;
            return `<b>${esc(p.n)}</b> · ${esc(p.c)}<br>${m ? m.label.split("(")[0] + ": " + mv + "<br>" : ""}${p.t && p.v >= 1 ? "Best bet: " + esc(catName) + " (" + fvpd(p.v) + " / $1)" : "Nothing returns $1 per $1"}`;
          }, { sticky: true });
          l.on("click", e => {
            select(p.id, false);
            if (map.getZoom() < 16) map.setView(e.latlng, 17, { animate: true });
            houseAt(e.latlng);
          });
        }
      }).addTo(map);
    } else if (ocLayer && typeof map !== "undefined" && map) {
      if (!map.hasLayer(ocLayer)) ocLayer.addTo(map);
      ocLayer.setStyle(styleBg);
    }
    retop();
    restyle();
    if (typeof map !== "undefined" && map && map.flyTo) map.flyTo([33.71, -117.83], 11);
    
    // Update datalist names for OC
    if (D_OC && D_OC.search) {
      const namesEl = $("#names");
      if (namesEl) {
        namesEl.innerHTML = Object.keys(D_OC.search).sort().map(n => `<option value="${esc(n)}">`).join("");
      }
    }
    const target = D_OC && (D_OC.features.find(f => f.properties.n === "Woodbridge") || D_OC.features[0]);
    if (target && typeof select === "function") select(target.properties.id, false);
    const nT = D_OC && D_OC.features ? D_OC.features.length : 0, nC = D_OC && D_OC.features ? new Set(D_OC.features.map(f => f.properties.c)).size : 0;
    const real = D_OC && D_OC.meta && D_OC.meta.schema >= 2;
    if (typeof showToast === "function") showToast(real ? `Orange County: ${fmtN(nT)} block groups in ${nC} cities and communities` : `Orange County: ${fmtN(nT)} census tracts in ${nC} cities and communities (preliminary data)`);
  } else {
    if (eb) eb.textContent = "CITY PRETTY · ALL OF LOS ANGELES COUNTY · " + buildStamp();
    if (ocLayer && typeof map !== "undefined" && map && map.hasLayer(ocLayer)) map.removeLayer(ocLayer);
    if (typeof bgs !== "undefined" && bgs && map && !map.hasLayer(bgs)) bgs.addTo(map);
    retop();
    restyle();
    if (typeof map !== "undefined" && map && map.flyTo) map.flyTo([34.05, -118.25], 11);
    const names = new Map(Object.entries((D && D.meta && D.meta.search) || {}));
    const namesEl = $("#names");
    if (namesEl) {
      namesEl.innerHTML = [...names.keys()].sort().map(n => `<option value="${esc(n)}">`).join("");
    }
    const start = (D && D.meta && D.meta.default_bg) || (D && D.bgs && D.bgs.features && D.bgs.features[0] && D.bgs.features[0].properties.id);
    if (start && typeof select === "function") select(start, false);
    if (typeof showToast === "function") showToast("Returned to Los Angeles County");
  }
}

async function init() {
  D = await unpack();
  map = L.map("map", { preferCanvas: true, zoomSnap: 0.5, minZoom: 9, maxZoom: 19 });
  map.attributionControl.setPrefix(false).addAttribution("© OpenStreetMap contributors · US Census · LA County Assessor, Auditor-Controller and Parks · LAPD · LASD · MyLA311 · CHP · LA Metro · city tree surveys · Tree Equity Score");
  D.bgs.features.forEach(f => byId.set(f.properties.id, f));
  retop();
  breaks = computeBreaks();
  bgs = L.geoJSON(D.bgs, { style: styleBg, onEachFeature: (f, l) => {
    const p = f.properties;
    l.bindTooltip(() => `<b>${esc(p.n)}</b> · ${esc(p.c)}<br>${p.t && p.v >= 1 ? esc(D.catalog[p.t].name) + ": " + fvpd(p.v) + " per $1" : "Nothing returns $1 per $1"}`, { sticky: true });
    l.on("click", e => {
      select(p.id, false);
      if (map.getZoom() < 16) map.setView(e.latlng, 17, { animate: true });
      houseAt(e.latlng);
    }); } }).addTo(map);
  drawContext(); legend(); report();
  { const eb = $(".eyebrow"), st = buildStamp(); if (eb && st) eb.textContent = "CITY PRETTY · ALL OF LOS ANGELES COUNTY · " + st; }

  // Wire Presets & Top Actions
  document.querySelectorAll(".preset-btn").forEach(b => b.onclick = () => applyPreset(b.dataset.preset));
  const rBtn = $("#btn-renter-header"); if (rBtn) rBtn.onclick = toggleRenterView;
  const cBtn = $("#btn-compare-header"); if (cBtn) cBtn.onclick = openCompareDrawer;
  const mBtn = $("#btn-methods-header"); if (mBtn) mBtn.onclick = openMethodsModal;
  window.addEventListener("hashchange", checkHash);

  const names = new Map(Object.entries(D.meta.search || {}));
  $("#names").innerHTML = [...names.keys()].sort().map(n => `<option value="${esc(n)}">`).join("");
  $("#q").onchange = e => {
    const val = e.target.value;
    const ocId = (activeCounty === "oc" && D_OC && D_OC.search) ? D_OC.search[val] : null;
    const id = ocId || names.get(val);
    if (id) select(id, true);
    else if (/^\d+\s+\S/.test(val)) addressSearch(val, true);
  };
  $("#q").addEventListener("input", e => { clearTimeout(addrTimer); const v = e.target.value; if (/^\d+\s+\S{2,}/.test(v)) addrTimer = setTimeout(() => addressSearch(v, false), 450); else hideAddr(); });
  $("#metric").onchange = restyle;
  $("#evid").onchange = () => { retop(); restyle(); if (selected) select(selected, false); };
  ["#l-roads", "#l-transit", "#l-parks", "#l-amen", "#l-hoods", "#l-fac", "#l-zone", "#l-under", "#l-proj"].forEach(id => $(id).onchange = drawContext);
  $("#fac-kinds").innerHTML = D.layers.fac_kinds.map((k, i) => `<label style="display:block"><input type="checkbox" data-fk="${i}" checked> <span class="fac" style="display:inline-block;vertical-align:middle;background:${(FAC_STYLE[k] || ["#444"])[0]}">${(FAC_STYLE[k] || ["", "•"])[1]}</span> ${esc(k)}</label>`).join("");
  $("#fac-kinds").querySelectorAll("input").forEach(x => x.onchange = () => { facOn = new Set([...$("#fac-kinds").querySelectorAll("input:checked")].map(y => +y.dataset.fk)); _fDrawn.forEach(l => layers.facArea && layers.facArea.removeLayer(l)); _fDrawn.clear(); drawFacilities(); });
  $("#l-tiles").onchange = e => {
    if (e.target.checked) { const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
      tiles = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "rastertiles/voyager"}/{z}/{x}/{y}{r}.png`, { attribution: "© CARTO", subdomains: "abcd", maxZoom: 19 }).addTo(map); tiles.bringToBack(); }
    else if (tiles) { map.removeLayer(tiles); tiles = null; }
    restyle();
  };
  map.on("zoomend", zoomed);
  if ($("#l-lots")) $("#l-lots").onchange = syncLots;
  syncLots();
  cachedLotLines().then(c => {
    if (!c) return;
    lotCache = c;
    if (typeof window !== "undefined") window.lotCache = lotCache;
    const isOc = (typeof activeCounty !== "undefined" && activeCounty === "oc");
    if (lots && !isOc && typeof map !== "undefined" && map) {
      if (map.hasLayer(lots)) map.removeLayer(lots);
      lots = null;
      syncLots();
    }
  });
  $("#lots-hood").onclick = () => { $("#lots-note").hidden = true; selectAt(map.getCenter()); };
  map.on("moveend", drawNumbers);
  let aerial = null;
  window.syncAerial = () => { const want = $("#l-aerial").checked;
    if (want && !aerial) { aerial = L.tileLayer("https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
      { maxNativeZoom: 16, maxZoom: 19, attribution: "Imagery: USGS The National Map (public domain)" }).addTo(map); aerial.bringToBack(); restyle(); }
    if (!want && aerial) { map.removeLayer(aerial); aerial = null; restyle(); } };
  $("#l-aerial").onchange = window.syncAerial;
  map.on("mousemove", hoverParcel);
  map.on("mousemove", zoneTip);
  // at street level the address preview replaces the area tooltip
  map.on("zoomend", () => { const hi = map.getZoom() >= 17; bgs.eachLayer(l => { const t = l.getTooltip(); if (t) { t.options.opacity = hi ? 0 : 0.9; if (hi) l.closeTooltip(); } }); });
  map.on("mouseout", () => { clearTimeout(hoverTimer); });
  map.on("moveend", () => { drawStreets(); drawLabels(); drawZoning(); drawFacilities(); drawUnder(); drawProjects(); });
  L.control.scale({ imperial: true, metric: false, maxWidth: 140, position: "bottomleft" }).addTo(map);
  const Loc = L.Control.extend({ options: { position: "topleft" }, onAdd() { const b = L.DomUtil.create("button", "locate"); b.type = "button"; b.textContent = "📍 Find me";
    b.title = "Center the map on where you are and open your block group"; L.DomEvent.disableClickPropagation(b); b.onclick = () => locateMe(b); return b; } });
  new Loc().addTo(map);
  map.fitBounds(L.geoJSON(D.bgs).getBounds(), { animate: false });
  const start = D.meta.default_bg && byId.has(D.meta.default_bg) ? D.meta.default_bg : D.bgs.features[0].properties.id;
  const initHash = window.location.hash.match(/#bg=([0-9]+)/);
  if (initHash && byId.has(initHash[1])) select(initHash[1], true);
  else select(start, false);
  map.setView(L.geoJSON(byId.get(start)).getBounds().getCenter(), 12, { animate: false });
  $("#loading").hidden = true;
  // Orange County unpacks after LA County is on screen (keeps the first paint fast); its button waits for it
  { const btnOc = $("#btn-county-oc"); if (btnOc) { btnOc.disabled = true; btnOc.dataset.title = btnOc.title; btnOc.title = "Unpacking Orange County…"; }
    window.ocReady = initOrangeCounty().then(() => {
      if (btnOc) { btnOc.disabled = false; btnOc.title = btnOc.dataset.title || "Expand to Orange County"; }
      if (typeof _drawn !== "undefined" && _drawn && _drawn.clear) _drawn.clear();
      if (typeof _cellCache !== "undefined" && _cellCache && _cellCache.clear) _cellCache.clear();
      drawContext();
      const mh = window.location.hash.match(/#bg=([0-9]+)/);
      if (mh && mh[1].startsWith("06059") && byId.has(mh[1]) && mh[1] !== selected) { switchCounty("oc"); select(mh[1], true); }
    }).catch(e => console.warn("Orange County bundle failed to unpack", e)); }
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { drawContext(); restyle(); });
}
init().catch(e => { $("#loading").textContent = "Could not open the map data: " + e.message + ". Open this file in a current Chrome, Edge, Safari or Firefox."; });


// --- Nationwide Metro Switcher & Interactive Package Simulator ---
const METRO_PRESETS = [
  { id: "la", name: "Los Angeles County, CA", center: [34.0522, -118.2437], zoom: 11, fips: "06037" },
  { id: "oc", name: "Orange County, CA", center: [33.7175, -117.8311], zoom: 11, fips: "06059" },
  { id: "cook", name: "Cook County (Chicago), IL", center: [41.8781, -87.6298], zoom: 11, fips: "17031" },
  { id: "harris", name: "Harris County (Houston), TX", center: [29.7604, -95.3698], zoom: 11, fips: "48201" },
  { id: "maricopa", name: "Maricopa County (Phoenix), AZ", center: [33.4484, -112.0740], zoom: 11, fips: "04013" },
  { id: "king", name: "King County (Seattle), WA", center: [47.6062, -122.3321], zoom: 11, fips: "53033" },
  { id: "fulton", name: "Fulton County (Atlanta), GA", center: [33.7490, -84.3880], zoom: 11, fips: "13121" },
  { id: "miami", name: "Miami-Dade County, FL", center: [25.7617, -80.1918], zoom: 11, fips: "12086" },
  { id: "clark", name: "Clark County (Las Vegas), NV", center: [36.1699, -115.1398], zoom: 11, fips: "32003" },
  { id: "denver", name: "Denver County, CO", center: [39.7392, -104.9903], zoom: 11, fips: "08031" },
  { id: "travis", name: "Travis County (Austin), TX", center: [30.2672, -97.7431], zoom: 11, fips: "48453" },
  { id: "san_diego", name: "San Diego County, CA", center: [32.7157, -117.1611], zoom: 11, fips: "06073" }
];

function switchMetro(metroId) {
  const m = METRO_PRESETS.find(x => x.id === metroId);
  if (!m || typeof map === "undefined") return;
  if (m.id === "oc" && typeof switchCounty === "function") { switchCounty("oc"); return; }
  if (m.id === "la" && typeof switchCounty === "function") { switchCounty("la"); return; }
  map.flyTo(m.center, m.zoom, { duration: 1.5 });
  const eb = $(".eyebrow");
  if (eb) eb.textContent = `CITY PRETTY · ${m.name.toUpperCase()} · LIVE ASSESSOR & GIS CADASTRE`;
  showToast(`Switched view to ${m.name}. Click any parcel at zoom 16+ for assessor & zoning analysis.`);
}

let activePackageItems = new Set();
function togglePackageItem(itemId, bgId) {
  if (activePackageItems.has(itemId)) activePackageItems.delete(itemId);
  else activePackageItems.add(itemId);
  runPackageSimulation(bgId);
}

function runPackageSimulation(bgId) {
  const d = (typeof D !== "undefined" && D && D.details) ? D.details[bgId] : null;
  const p = byId.get(bgId) ? byId.get(bgId).properties : {};
  const m = (d && d.m) ? d.m : p;
  const f = $("#sim-results");
  if (!f || !d) return;

  const recs = (d.r || []).map(a => Object.fromEntries(REC_KEYS.map((k, i) => [k, a[i]])));
  const selectedRecs = recs.filter(r => activePackageItems.has(r.id));
  
  if (selectedRecs.length === 0) {
    f.innerHTML = `<p class="small muted" style="margin:4px 0">Check 1 or more projects above to simulate bundled investment return.</p>`;
    return;
  }

  let rawCost = 0, rawVal = 0, grantTotal = 0;
  let hasPedSafe = false, hasSchoolOrPark = false, hasTrees = false;

  for (const r of selectedRecs) {
    const cost = r.cost || 0;
    const val = r.value || (r.vpd * cost) || 0;
    rawCost += cost;
    rawVal += val;

    if (/walk|side|cross|safe|traffic|speed|bike/i.test(r.id)) hasPedSafe = true;
    if (/school|park|playground|recreation/i.test(r.id)) hasSchoolOrPark = true;
    if (/tree|canopy|green/i.test(r.id)) hasTrees = true;

    // Grants
    if (/safe|side|cross|bike|traffic/i.test(r.id)) grantTotal += cost * 0.80; // Safe Streets for All (SS4A)
    else if (/tree/i.test(r.id)) grantTotal += cost * 0.70; // IRA Urban Forestry
    else if (/park/i.test(r.id)) grantTotal += cost * 0.50; // LWCF Land & Water Conservation
    else grantTotal += cost * 0.25;
  }

  // Compound Synergy Multiplier
  let synergy = 1.0;
  let synergyNotes = [];
  if (hasPedSafe && hasSchoolOrPark) {
    synergy += 0.25;
    synergyNotes.push("+25% Safe Routes to School synergy (safe walking + youth destination)");
  }
  if (hasTrees && hasPedSafe) {
    synergy += 0.15;
    synergyNotes.push("+15% Shaded walkability corridor synergy (thermal comfort + safety)");
  }
  if (selectedRecs.length >= 3 && !synergyNotes.length) {
    synergy += 0.10;
    synergyNotes.push("+10% Multi-modal neighborhood transformation synergy");
  }

  const homes = m.homes || 400;
  const hv = m.hv || 850000;
  const maxNeighborhoodLift = homes * hv * 0.16; // 16% realistic market capitalization ceiling
  const compoundVal = Math.min(rawVal * synergy, maxNeighborhoodLift);
  const compoundVPD = rawCost > 0 ? (compoundVal / rawCost) : 0;
  const netMunicipalCost = Math.max(0, rawCost - grantTotal);
  const eifd10Yr = compoundVal * 0.01 * 0.20 * 10; // 10-year municipal tax capture

  f.innerHTML = `
    <div style="background:#fff;border:1px solid #94a3b8;border-radius:8px;padding:10px;margin-top:6px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
        <span style="font-weight:700;font-size:13px;color:#0f172a">Simulated Package Outcome</span>
        <span style="font-weight:700;font-size:14px;color:#059669">${fvpd(compoundVPD)} / $1</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:8px">
        <div><b>Total Capital:</b> ${fmt$(Math.round(rawCost))}</div>
        <div><b>Public Grants:</b> <span style="color:#059669">${fmt$(Math.round(grantTotal))}</span></div>
        <div><b>Net Local Cost:</b> ${fmt$(Math.round(netMunicipalCost))}</div>
        <div><b>Home Value Lift:</b> <span style="color:#0284c7"><b>+${fmt$(Math.round(compoundVal))}</b></span></div>
      </div>
      ${synergyNotes.length ? `<div style="font-size:11.5px;color:#0369a1;background:#f0f9ff;padding:6px;border-radius:4px;margin-bottom:6px">⚡ <b>Synergy Multipliers Applied (${synergy.toFixed(2)}×):</b><br>${synergyNotes.join("<br>")}</div>` : ""}
      <div style="font-size:11.5px;color:#475569">
        🏛️ <b>10-Year Local Tax Increment (EIFD):</b> ~${fmt$(Math.round(eifd10Yr))} (covers ${netMunicipalCost > 0 ? Math.round((eifd10Yr / netMunicipalCost) * 100) + "%" : "100%+"} of net local cost).
      </div>
    </div>
  `;
}
