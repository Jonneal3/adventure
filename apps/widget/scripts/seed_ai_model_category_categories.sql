-- Seed category_use_cases explicitly from categories_rows.csv
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'use_case_type') THEN
    CREATE TYPE public.use_case_type AS ENUM ('tryon', 'scene');
  END IF;
END$$;

-- try-on => tryon, model: bytedance/seedream-4
-- scene-placement => scene, model: black-forest-labs/flux-1.1-pro

-- Women's, Children's, and Infants' Clothing and Accessories Merchant Wholesalers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '023993ca-b768-4f19-bf61-24c3e59b5fbb', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '023993ca-b768-4f19-bf61-24c3e59b5fbb');
-- Wood Kitchen Cabinet and Countertop Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '0260d30b-411d-4b56-9241-61e7a8a56b30', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '0260d30b-411d-4b56-9241-61e7a8a56b30');
-- Interior Design
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '02e151e0-5484-4245-99f3-950cf09d8534', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '02e151e0-5484-4245-99f3-950cf09d8534');
-- Landscape Architectural Services
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '04650aea-dbc0-4e10-9985-5526b11af273', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '04650aea-dbc0-4e10-9985-5526b11af273');
-- Women's Clothing Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '04b19281-9b5d-4af5-ac1e-1e7ce7a5b2ee', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '04b19281-9b5d-4af5-ac1e-1e7ce7a5b2ee');
-- Household Appliances, Electric Housewares, and Consumer Electronics Merchant Wholesalers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '0750854f-7550-4bb6-9669-6750314f752b', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '0750854f-7550-4bb6-9669-6750314f752b');
-- Retail Bakeries
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '090f310d-2627-47b5-8294-07d0c4945e3b', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '090f310d-2627-47b5-8294-07d0c4945e3b');
-- Beauty Salons
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '09a763f6-6b1c-4406-9e2c-0c8abdf7eae2', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '09a763f6-6b1c-4406-9e2c-0c8abdf7eae2');
-- Furniture Store
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '0a8be980-8dd2-463e-a4a7-36e383ac235f', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '0a8be980-8dd2-463e-a4a7-36e383ac235f');
-- Other Heavy and Civil Engineering Construction
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '0b3f3797-c9cb-4efb-a4d8-6f1c20b08511', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '0b3f3797-c9cb-4efb-a4d8-6f1c20b08511');
-- Water Supply and Irrigation Systems
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '0ffcf9c1-0579-4d18-be88-4ea8205651dd', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '0ffcf9c1-0579-4d18-be88-4ea8205651dd');
-- Outdoor Advertising
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '1165a325-2ddf-49e4-aedc-191a02936fd4', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '1165a325-2ddf-49e4-aedc-191a02936fd4');
-- Other Pressed and Blown Glass and Glassware Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '145a4b74-f3bc-42c6-b7fc-c6a70d90d912', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '145a4b74-f3bc-42c6-b7fc-c6a70d90d912');
-- Other Activities Related to Real Estate
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '17e7e451-fd7b-49a3-b2e6-589a7435fc7b', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '17e7e451-fd7b-49a3-b2e6-589a7435fc7b');
-- Nail Salons
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '19073ded-7fda-4d2b-9bc7-8a517295b998', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '19073ded-7fda-4d2b-9bc7-8a517295b998');
-- Prefabricated Metal Building and Component Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '1b0ecf2e-bc10-4506-81b0-e8d700f0c888', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '1b0ecf2e-bc10-4506-81b0-e8d700f0c888');
-- Ready-Mix Concrete Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '2039f115-7ff1-4972-a6ab-4ddf633edef1', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '2039f115-7ff1-4972-a6ab-4ddf633edef1');
-- Leather and Hide Tanning and Finishing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '215211b3-eafe-4f6e-8244-666254ffda58', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '215211b3-eafe-4f6e-8244-666254ffda58');
-- Drywall and Insulation Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '21ece16f-d247-47bd-ba35-139ff8369b3e', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '21ece16f-d247-47bd-ba35-139ff8369b3e');
-- Men's and Boys' Clothing and Furnishings Merchant Wholesalers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '222d18cf-1604-4ace-8c5f-7026ae53ff51', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '222d18cf-1604-4ace-8c5f-7026ae53ff51');
-- Nursery, Garden Center, and Farm Supply Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '233aa316-c149-4f46-a2c6-5876c0d9d824', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '233aa316-c149-4f46-a2c6-5876c0d9d824');
-- Sewing, Needlework, and Piece Goods Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '263225cf-ada3-442c-b54e-ade7b4504071', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '263225cf-ada3-442c-b54e-ade7b4504071');
-- Light Truck and Utility Vehicle Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '272f1b0b-34f0-4a9e-9f48-9b5bc7cc8047', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '272f1b0b-34f0-4a9e-9f48-9b5bc7cc8047');
-- Plumbing Fixture Fitting and Trim Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '28e49a00-64f5-41cf-b60f-10eef32d2ae4', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '28e49a00-64f5-41cf-b60f-10eef32d2ae4');
-- Plastics Plumbing Fixture Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '29293ad4-c751-4662-b574-efa88ea484d5', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '29293ad4-c751-4662-b574-efa88ea484d5');
-- Lumber, Plywood, Millwork, and Wood Panel Merchant Wholesalers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '2ac9f236-971b-4286-95f3-18473889cbb6', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '2ac9f236-971b-4286-95f3-18473889cbb6');
-- Interior Design Services
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '2aeabf0a-7ec3-44b7-a194-397fb7e0f07d', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '2aeabf0a-7ec3-44b7-a194-397fb7e0f07d');
-- Household Furniture (except Wood and Metal) Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '2c4f6605-debb-4b43-afb7-d3007670d65a', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '2c4f6605-debb-4b43-afb7-d3007670d65a');
-- Glass and Glazing Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '2cd7a7c1-39ed-4f2a-b201-6e9e0c8c4bbb', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '2cd7a7c1-39ed-4f2a-b201-6e9e0c8c4bbb');
-- Children's and Infants' Clothing Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '2e2b2bff-21d3-4769-89ea-538d98e879b3', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '2e2b2bff-21d3-4769-89ea-538d98e879b3');
-- Automobile and Other Motor Vehicle Merchant Wholesalers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '2ef9e960-d116-4681-aa27-49c9da627f1e', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '2ef9e960-d116-4681-aa27-49c9da627f1e');
-- Paint and Wallpaper Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '359d79ad-a286-425d-85ed-82466b0bdd9a', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '359d79ad-a286-425d-85ed-82466b0bdd9a');
-- Women’s, Girls’, and Infants’ Cut and Sew Apparel Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '3639bcae-0235-4cd2-8fe4-f7e22de98975', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '3639bcae-0235-4cd2-8fe4-f7e22de98975');
-- Vending Machine Operators
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '37b7b968-cbae-41fc-96a0-02ea8d6c99f5', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '37b7b968-cbae-41fc-96a0-02ea8d6c99f5');
-- All Other Home Furnishings Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '382515fb-520f-4913-bf5a-974473f41417', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '382515fb-520f-4913-bf5a-974473f41417');
-- Poured Concrete Foundation and Structure Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '3c144198-f7bc-4c77-916b-ae127efae243', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '3c144198-f7bc-4c77-916b-ae127efae243');
-- Men's Clothing Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '3c54348a-0588-420e-9381-634ad35d13fb', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '3c54348a-0588-420e-9381-634ad35d13fb');
-- Other Personal and Household Goods Repair and Maintenance
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '41f8eb9c-9108-46e3-af72-3fdb9ab5f974', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '41f8eb9c-9108-46e3-af72-3fdb9ab5f974');
-- Commercial, Industrial, and Institutional Electric Lighting Fixture Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '42923856-1c34-45fe-9fb7-4808b9016dc0', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '42923856-1c34-45fe-9fb7-4808b9016dc0');
-- Furniture Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '46882274-d7be-46a9-8427-8bc77d73b2bd', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '46882274-d7be-46a9-8427-8bc77d73b2bd');
-- Highway, Street, and Bridge Construction
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '46e25a3f-b302-4a5a-bac6-0db4be5961ef', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '46e25a3f-b302-4a5a-bac6-0db4be5961ef');
-- Custom Architectural Woodwork and Millwork Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '475e027d-171c-4c6a-9dad-e15f807aec4e', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '475e027d-171c-4c6a-9dad-e15f807aec4e');
-- Hotels (except Casino Hotels) and Motels
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '47b88cc9-086d-47f3-906d-47f36885871e', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '47b88cc9-086d-47f3-906d-47f36885871e');
-- Offices of All Other Miscellaneous Health Practitioners
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '481a5864-f28f-4c93-bf8d-b6277eb7356b', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '481a5864-f28f-4c93-bf8d-b6277eb7356b');
-- Used Merchandise Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '5040505b-71d9-4fb9-b539-51045a3e5a99', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '5040505b-71d9-4fb9-b539-51045a3e5a99');
-- New Car Dealers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '537d3c01-d5b1-4cff-99d0-7f51bc2e1b85', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '537d3c01-d5b1-4cff-99d0-7f51bc2e1b85');
-- New Housing For-Sale Builders
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '53c51624-cda4-4ecc-918b-2c7f9925d6a6', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '53c51624-cda4-4ecc-918b-2c7f9925d6a6');
-- Masonry Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '5450b214-bccd-45dd-a4a1-08c5e7067726', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '5450b214-bccd-45dd-a4a1-08c5e7067726');
-- Flooring Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '549e647f-b139-4298-aa7e-86bd9b23e0ab', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '549e647f-b139-4298-aa7e-86bd9b23e0ab');
-- Floor Covering Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '56819f4b-979c-4d22-bd31-01c8e03053f2', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '56819f4b-979c-4d22-bd31-01c8e03053f2');
-- Solar Electric Power Generation
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '570e8aea-208e-4b5d-b28a-8d40b40fea71', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '570e8aea-208e-4b5d-b28a-8d40b40fea71');
-- Landscaping Services
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '59466ae2-0c49-4e67-8689-a7ba63986b1b', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '59466ae2-0c49-4e67-8689-a7ba63986b1b');
-- Travel Trailer and Camper Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '595c5fa0-310d-43d3-948d-4fd67aa0b48d', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '595c5fa0-310d-43d3-948d-4fd67aa0b48d');
-- Security Guards and Patrol Services
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '5ae15d10-a781-4104-9960-841c07f593fb', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '5ae15d10-a781-4104-9960-841c07f593fb');
-- Ornamental and Architectural Metal Work Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '5caf5bfc-7590-4f95-91be-377f179a5f04', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '5caf5bfc-7590-4f95-91be-377f179a5f04');
-- Roofing Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '5ead5a6d-d9c2-4445-8d03-bd92463ab912', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '5ead5a6d-d9c2-4445-8d03-bd92463ab912');
-- Tile and Terrazzo Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '617e3074-5d7c-46b5-a034-9fa22bd6aa61', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '617e3074-5d7c-46b5-a034-9fa22bd6aa61');
-- Commercial and Institutional Building Construction
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '6415a4a5-1542-4662-b04f-e67166432425', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '6415a4a5-1542-4662-b04f-e67166432425');
-- Painting and Wall Covering Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '64fe0f37-5ee5-44d9-a51e-a5dfc003ef9f', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '64fe0f37-5ee5-44d9-a51e-a5dfc003ef9f');
-- Wood Office Furniture Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '6607a949-2b8a-4c11-ba1b-5d2d0b9b192d', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '6607a949-2b8a-4c11-ba1b-5d2d0b9b192d');
-- Family Clothing Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '67f2e5dc-540a-4644-a082-de02f884842d', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '67f2e5dc-540a-4644-a082-de02f884842d');
-- Paint and Coating Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '6cc54536-8ac2-4861-b92b-305d426eafaa', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '6cc54536-8ac2-4861-b92b-305d426eafaa');
-- Landscaping
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '717eda02-54e2-4a15-b313-965c9501715a', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '717eda02-54e2-4a15-b313-965c9501715a');
-- Other Building Finishing Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '73cd6ad7-5eb2-4854-a020-98d67209c3cd', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '73cd6ad7-5eb2-4854-a020-98d67209c3cd');
-- Residential Property Managers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '74ce54ae-3ea2-4c26-9b44-ee7527689fc3', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '74ce54ae-3ea2-4c26-9b44-ee7527689fc3');
-- Other Clothing Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '7623be38-46d4-42e5-b217-ad3ca7238670', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '7623be38-46d4-42e5-b217-ad3ca7238670');
-- Architectural Services
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '78a8a056-616e-405b-be6d-d541dbff19e3', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '78a8a056-616e-405b-be6d-d541dbff19e3');
-- Full-Service Restaurants
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '7b1d33a8-b7ed-458b-8353-3b9d443c5eba', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '7b1d33a8-b7ed-458b-8353-3b9d443c5eba');
-- Metal Service Centers and Other Metal Merchant Wholesalers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '7cc932c4-8031-4182-be82-89475c71c746', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '7cc932c4-8031-4182-be82-89475c71c746');
-- Structural Steel and Precast Concrete Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '7cf68c6a-a6aa-4abe-a81c-7e7ed775e827', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '7cf68c6a-a6aa-4abe-a81c-7e7ed775e827');
-- Lessors of Other Real Estate Property
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '7e183322-8a51-4402-b87b-6b50ad8ec5eb', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '7e183322-8a51-4402-b87b-6b50ad8ec5eb');
-- Women's Handbag and Purse Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '7f21620c-053f-4dcd-aaae-ccf160f99b59', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '7f21620c-053f-4dcd-aaae-ccf160f99b59');
-- Metal Window and Door Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '88de7447-16d3-4b00-948d-00e4aec98ae9', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '88de7447-16d3-4b00-948d-00e4aec98ae9');
-- Hair Salon
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '891486de-fa71-461e-97d8-1e7383b00e86', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '891486de-fa71-461e-97d8-1e7383b00e86');
-- Wood Window and Door Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '8978834c-de2b-4713-a5ac-a232bb20232f', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '8978834c-de2b-4713-a5ac-a232bb20232f');
-- Other Personal Care Services
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '8c07b142-9673-4897-b058-bf81dd2d0ecd', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '8c07b142-9673-4897-b058-bf81dd2d0ecd');
-- Photography Studios, Portrait
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '910a3a4e-b8e6-4eae-8a3c-16d5dbd0f633', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '910a3a4e-b8e6-4eae-8a3c-16d5dbd0f633');
-- Residential Remodelers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '9379c61e-cf0a-4884-a312-ba909a61d931', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '9379c61e-cf0a-4884-a312-ba909a61d931');
-- Finish Carpentry Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '94b7604f-8677-4939-bd3b-1c1461117fd3', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '94b7604f-8677-4939-bd3b-1c1461117fd3');
-- Mobile Food Services
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '99b620b1-f79d-411a-86a7-723b5f1d9858', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '99b620b1-f79d-411a-86a7-723b5f1d9858');
-- Wood Container and Pallet Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '99d77300-d3f4-4a10-a3ee-4b9221f28e50', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '99d77300-d3f4-4a10-a3ee-4b9221f28e50');
-- Site Preparation Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '9d2f8cba-3f03-4d4b-a3ac-fb913579297a', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '9d2f8cba-3f03-4d4b-a3ac-fb913579297a');
-- Paint, Varnish, and Supplies Merchant Wholesalers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT '9d503f5e-9c85-4dc3-a0f1-0bd89a919ce1', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = '9d503f5e-9c85-4dc3-a0f1-0bd89a919ce1');
-- Window Treatment Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'a27d44ea-6de8-4f7e-a6b8-fb05631d97b9', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'a27d44ea-6de8-4f7e-a6b8-fb05631d97b9');
-- Offices of Physicians (except Mental Health Specialists)
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'a323c8b7-18b2-4af0-96fe-c1e3845a98e7', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'a323c8b7-18b2-4af0-96fe-c1e3845a98e7');
-- Barber Shops
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'a52ab122-a512-44b3-a3f5-d3b0a5ae3b20', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'a52ab122-a512-44b3-a3f5-d3b0a5ae3b20');
-- RV (Recreational Vehicle) Parks and Campgrounds
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'a589198b-05a4-434b-a760-2128c551a3d8', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'a589198b-05a4-434b-a760-2128c551a3d8');
-- Sign Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'a81b15bf-3d12-45d6-a3be-8789f188e108', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'a81b15bf-3d12-45d6-a3be-8789f188e108');
-- Roofing, Siding, and Insulation Material Merchant Wholesalers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'aa544ab8-0559-4f50-b981-846ab9c2cc95', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'aa544ab8-0559-4f50-b981-846ab9c2cc95');
-- Wood Preservation
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'af0bf799-d447-4674-be95-6c8751628e10', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'af0bf799-d447-4674-be95-6c8751628e10');
-- Shoe Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'af894884-d306-4272-89df-777d819956c1', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'af894884-d306-4272-89df-777d819956c1');
-- Other Concrete Product Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'b2c2d69b-38a1-4d8a-a93d-c6359ddf2e22', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'b2c2d69b-38a1-4d8a-a93d-c6359ddf2e22');
-- Lessors of Residential Buildings and Dwellings
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'b385410c-21dc-46ee-b32d-c96f10d3ad6f', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'b385410c-21dc-46ee-b32d-c96f10d3ad6f');
-- Metal Household Furniture Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'b5c24e7c-1248-4d4a-83d7-e2cff293a0ba', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'b5c24e7c-1248-4d4a-83d7-e2cff293a0ba');
-- Home Centers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'bea1a1f7-27c2-46dc-8f36-d37575eaa067', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'bea1a1f7-27c2-46dc-8f36-d37575eaa067');
-- Pet and Pet Supplies Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'bf040dd5-db83-4b4b-a32a-266b765fb000', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'bf040dd5-db83-4b4b-a32a-266b765fb000');
-- Home Furnishing Merchant Wholesalers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'bf303941-0d38-4b20-99df-a1568969a373', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'bf303941-0d38-4b20-99df-a1568969a373');
-- Other Specialized Design Services
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'c157ff78-7213-4710-a961-1ba8e08b1e0c', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'c157ff78-7213-4710-a961-1ba8e08b1e0c');
-- Clothing Accessories Stores
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'ca373031-0aac-43af-9a3d-a0e275856137', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'ca373031-0aac-43af-9a3d-a0e275856137');
-- Siding Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'cb6e2e65-9ae4-4952-aefe-93e0d3ab98ab', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'cb6e2e65-9ae4-4952-aefe-93e0d3ab98ab');
-- Electrical Contractors and Other Wiring Installation Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'd058b9f1-d9fc-4a6d-9ce0-bb266e91a200', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'd058b9f1-d9fc-4a6d-9ce0-bb266e91a200');
-- Glass Product Manufacturing Made of Purchased Glass
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'd16420a6-b3e7-4122-990c-68ec7e4106a7', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'd16420a6-b3e7-4122-990c-68ec7e4106a7');
-- Soil Preparation, Planting, and Cultivating
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'd4355fca-d7c5-4962-81a8-0d9d8060c4b1', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'd4355fca-d7c5-4962-81a8-0d9d8060c4b1');
-- Prefabricated Wood Building Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'd471808b-5f1d-4cb6-8e1b-bf4c660312bb', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'd471808b-5f1d-4cb6-8e1b-bf4c660312bb');
-- Plumbing, Heating, and Air-Conditioning Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'd72bf185-df77-45eb-aeee-1a8c22ab643a', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'd72bf185-df77-45eb-aeee-1a8c22ab643a');
-- Offices of Real Estate Agents and Brokers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'dc585b01-51dc-4b66-b899-a94fe54299bb', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'dc585b01-51dc-4b66-b899-a94fe54299bb');
-- All Other Specialty Trade Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'dcc10148-fe45-4ab0-8076-79b6c2e52366', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'dcc10148-fe45-4ab0-8076-79b6c2e52366');
-- Electronic Shopping and Mail-Order Houses (Ecomm)
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'dce2b907-d7d3-42f0-86af-d86f9b79bb2b', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'dce2b907-d7d3-42f0-86af-d86f9b79bb2b');
-- Fashion
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'e18d2cee-a2f5-4720-a71d-499768a112b1', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'e18d2cee-a2f5-4720-a71d-499768a112b1');
-- Reconstituted Wood Product Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'e50da547-efee-4290-82e5-913666a5ddd3', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'e50da547-efee-4290-82e5-913666a5ddd3');
-- Residential Electric Lighting Fixture Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'e75095cb-4bac-4db4-bff0-cfd99f8b6bb6', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'e75095cb-4bac-4db4-bff0-cfd99f8b6bb6');
-- Other Building Equipment Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'ea70e416-7164-4bb2-8990-023d6f4d04ff', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'ea70e416-7164-4bb2-8990-023d6f4d04ff');
-- Other Building Material Dealers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'ee2504e2-404a-49be-9672-e232c452d50f', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'ee2504e2-404a-49be-9672-e232c452d50f');
-- Upholstered Household Furniture Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'efc15f83-f229-4164-be23-8b66f3bf5643', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'efc15f83-f229-4164-be23-8b66f3bf5643');
-- Cut and Sew Apparel Contractors
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'f1263b50-e5fd-4a39-8927-54a3f5ed2c1c', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'f1263b50-e5fd-4a39-8927-54a3f5ed2c1c');
-- Automotive Glass Replacement Shops
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'f286e148-6de3-4452-98b4-4c127bc46873', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'f286e148-6de3-4452-98b4-4c127bc46873');
-- Textile and Fabric Finishing Mills
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'f34d0e6b-2ed2-402f-b77f-7108ae58a176', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'f34d0e6b-2ed2-402f-b77f-7108ae58a176');
-- Nonresidential Property Managers
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'f574715e-9e28-431d-a6a9-c475789115a9', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'f574715e-9e28-431d-a6a9-c475789115a9');
-- Lessors of Nonresidential Buildings (except Miniwarehouses)
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'fd3bd524-37bd-4f3f-963a-8fff8932e7c7', 'scene'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'fd3bd524-37bd-4f3f-963a-8fff8932e7c7');
-- Glass Container Manufacturing
INSERT INTO public.category_use_cases (category_id, use_case, ai_model_profile)
SELECT 'ff5fcffe-cc53-4837-989b-80cc40f4bc04', 'tryon'::public.use_case_type, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.category_use_cases cu WHERE cu.category_id = 'ff5fcffe-cc53-4837-989b-80cc40f4bc04');
COMMIT;
