There has been a huge change in the scope of our build for this project.  
The company currently uses an ERP system to generate memos for travel request. How it currently works is that the Staff writes a memo via ERP for the HOD to peruse and then if approved then forwards the memo to HR and HR does it calculation against the travel policy which i will include down below. 
Now the new flow is that we require the staff to visit this platform and enter the memo number that was generated from the ERP and this platform will now handle the workflow..
After entering the unique memo number, the next thing we want to do is to pull all the details related to that trip from the ERP via an API call to the ERP system. Thats one way to look at it and if calling from the erp api would be too much, we could have the staff enter the details manually. 
The MD dashboard is being scrapped so that she now gets to approve and reject in her ERP dashboard. so on the HR clicking submit after reviewing the staff request, it sends the data with the unique memo the staff had generated from the begining in the ERP, back to the MD's ERP, the current flow is that HR does the calculations in the ERP when the request gets to them, this platform takes away all that manual labor but it will be defeated if after this platform does all the calculations, the HR still has to go the ERP and create a memo. We want the submit button on this platform to do the memo creation automatically or queue it. I will need your expert review on this. 
And the form details for the staff request slightly changes, it fetches the staff name and level on login and you would understand how it changes in other areas when you see the travel policy, I would also like to know your input on the fact that the MD suggested we move from the current OTP system to an onprem sign in method. Explore that idea and let me know its limitation and better alternative we could consider.
when the staff enters their destination in the request and choose an origin from the four allowed locations;abuja, lagos, kaduna and gombe, the total estiamted cost is automatically calculated against the travel policy and then forwarded to the HR who can edit the cost of various fields like the number of days allowed, airport taxi cost, air fair for local travels.
For international trips, the allocation comes from the ministry so it isn't done in house so we are not going to bother about international trips on this platform. 
The Travel policy is as follows; DTA(Duty Travel Allowance) is split into two major categories, 100% cover and 75% cover. 
100% cover applies to 3 locations; Lagos, Abuja and Port Harcourt.
75% cover applies to all other locations that are not Lagos, Abuja and Port Harcourt.
DTA for MD/CEO - 60,000 
DTA for Executive Directors - 60,000 
DTA for Assistant General Managers(AGM) to General Managers(GM) - 40,000 
DTA for Assistant Managers(AM) to Senior Managers(SM) - 30,000 
DTA for Senior officers to lowest rank - 15,000 
these are for locations where it is 100% covered, you will do the 75% calculations for the other locations and then the estiamted cost will be an aggregation of all cost inputs by the staff on the form, then forwarded to the HR.
For local runnings which depends on the number of days, MD - 18,000 , EDs- 18,000, AGMs - GMs - 12, 000, AMs - SMs - 9,000, Senior Officers to lowest rank - 4,500.
You will also do the 75% calculations for the other locations and then the estiamted cost will be an aggregation of all cost inputs by the staff on the form, then forwarded to the HR.
Airfare for local travels depends on the destination, the staff will have to select the destination from the dropdown and then the system will calculate the airfare for the destination, but the default should be 150,000 to and another 150,000 fro. The HR has the right to change this figures depending on the unique situation of the staff. 
Airport taxi is 40,000 to and 40,000 fro. while roadtrips is calculated based on destination but default is 50,0000 going and 50,000 coming. so HR can still edit this based on the unique staff situation. 
