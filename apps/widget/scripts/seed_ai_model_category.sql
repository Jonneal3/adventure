-- Seed ai_model_category based on subcategory content (generated)
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_model_category_enum') THEN
    CREATE TYPE public.ai_model_category_enum AS ENUM ('try-on', 'scene-placement');
  END IF;
END$$;
ALTER TABLE public.categories_subcategories ADD COLUMN IF NOT EXISTS ai_model_category public.ai_model_category_enum;
CREATE INDEX IF NOT EXISTS idx_categories_subcategories_ai_model_category ON public.categories_subcategories (ai_model_category);

-- General Upholstered Household Furniture Manufacturing
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '00c1020d-6db2-4e7a-ab39-ee2084cac769';
-- General Window Treatment Stores (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '02973649-161b-4bbb-bfe0-57f34735d7f4';
-- General Other Specialized Design Services (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '06b53935-adfa-4d15-ab73-f578b97e3109';
-- Exterior Painting (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '0cb2c53e-654f-4ea9-bf7d-d51055bc7b36';
-- Structural / Modular Design (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '12951b8a-b881-4483-8e80-3c293e5b1407';
-- Irrigation System Layout (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '1297b891-73db-408c-90ed-4dbbf83269cd';
-- Roof Replacement Design (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '13fef87a-0ae6-4d99-a7eb-9ad320548485';
-- Fire Pit Designs (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '15dc9b02-a0e5-4b01-9821-39c74a43c850';
-- General Textile and Fabric Finishing Mills (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '15f51b36-dd8e-4f33-86c3-bbbbadad6c15';
-- General Plastics Plumbing Fixture Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '1730cd9c-13dd-4a52-9d83-7fcb7f380f02';
-- Carpeting (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '17b71841-803a-4dab-ba75-26b97e972cbe';
-- General Poured Concrete Foundation and Structure Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '17eae602-654f-4a74-8101-d912ab1a2265';
-- Landscaping (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '1b82080e-f934-4c46-a3c6-0e2f033ced62';
-- Walkways (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '1b9db5f2-801f-4515-a153-dc5e7d890193';
-- General Prefabricated Wood Building Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '1d8c88c5-841d-4f43-a748-b59dd421e233';
-- General New Housing For-Sale Builders (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '1efa69c9-c4c9-4ebe-a0cd-2546a173de59';
-- General Clothing Accessories Stores
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '1f0f2bcc-b292-4268-bd1b-9978953b1177';
-- General Retail Bakeries (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '1f8efbf5-91d4-4f85-99bc-13b954d39c5c';
-- General Finish Carpentry Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '2131f723-7069-4531-a575-25e020ba8d37';
-- General Interior Design Services (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '226dea96-ead2-4336-ba19-cd408828d920';
-- Fireplace (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '23e09b53-c422-4213-9d30-0b4c9f3d0c48';
-- General Offices of Real Estate Agents and Brokers (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '25e2bfb9-71cb-469d-8cd1-9fde20a0c8ab';
-- General Other Building Finishing Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '28cd03dd-7273-42da-98b2-b00148bc592b';
-- General Plumbing, Heating, and Air-Conditioning Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '2b6d2c80-0f74-4ba6-a1d4-407126ad8892';
-- Solar Panel Design (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '2b8fa128-5f07-4931-8344-4bf2921250b4';
-- Hair Extensions (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '31d30b35-4c38-4257-b26b-c65fffe17926';
-- General Masonry Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '32030ca7-6e82-4c6c-8d97-45a054655dbf';
-- All Ecomm. (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '32e36604-9c0c-4f72-80a6-7c7ea1698bef';
-- General Home Furnishing Merchant Wholesalers (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '38459c90-f10c-4c7b-bc1c-66af33fc7e29';
-- Garage (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '390adcb5-bea9-4eb7-ad27-bb5032f5a539';
-- Tiny Home Layout (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '393103a9-9336-49eb-ae6e-5f44993fc657';
-- Interior Design (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '3a5425f8-8a0c-415c-b230-ec72c8c75939';
-- General Sewing, Needlework, and Piece Goods Stores (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '3b168678-9b50-4a65-810e-7d246b3d6baf';
-- General Other Personal Care Services (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '3c0d4425-225c-476c-80e0-2a4a0093ba2d';
-- General Other Pressed and Blown Glass and Glassware Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '3c996ff7-4bfa-4459-a57d-0fb93c1af91c';
-- General Full-Service Restaurants (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '3d98171c-c5fc-433f-9f79-5cef008a6ca2';
-- General Painting and Wall Covering Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '3fe55f04-6b17-4f74-b89d-d84e0abab943';
-- Artwork & Wall Decor (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '4045afea-ee8a-43ef-b0b5-de7c096f1370';
-- General Glass Container Manufacturing
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '410efc09-2fb2-446f-a9cd-d51e4d3f9a9a';
-- Gazebo / Pergola (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '414549f1-43b6-4c97-965a-4b30e2e9b128';
-- Windows (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '41c627b9-bbba-4520-8761-e0f9d072fcfd';
-- General Solar Electric Power Generation (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '446a614a-1752-4703-a9fe-9f3c8a1f9c37';
-- Sauna (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '479e6c77-063a-492d-b40f-1d256127c7a9';
-- General Household Furniture (except Wood and Metal) Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '48a7f987-a669-4c85-9967-9b3b7ec31b73';
-- Campground Layout (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '4a066caf-4eeb-435e-adb0-3b463ecf0e58';
-- Wig & Hairpiece (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '4b9e32e1-1db5-40b7-b2c5-01b8b676e0e3';
-- General Commercial and Institutional Building Construction (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '4ba314aa-e33a-4ea8-b7cc-f7a66f2188de';
-- Microblading (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '4d1a507b-daa0-4815-a4db-2bb583bcd372';
-- General All Other Home Furnishings Stores
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '504077d6-e90d-45a6-9422-e1180e1147e8';
-- Water Features (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '52217148-4ef8-407a-8d6d-42ac965ab521';
-- Lashes (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '550c731b-d14c-45b8-bbe1-d5da7b9faa27';
-- Thrift
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '55fb2067-e603-40b7-bd3b-deed27a2efc5';
-- General Other Heavy and Civil Engineering Construction (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '56fe06ec-fa41-4d09-a011-9da8c8759979';
-- General Flooring Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '585ed174-ccee-4c4f-b902-fddcd43b4d41';
-- Home Gym (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '5ae75d5f-9974-48fb-8b50-5d23ac5d474b';
-- General RV (Recreational Vehicle) Parks and Campgrounds (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '5c6a9d26-3878-4ac5-961c-69224c48aa1a';
-- Siding Replacement (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '5ce7f3bd-67ed-4a06-8bf3-8fdcaf87d7d6';
-- General Wood Window and Door Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '5da6681c-b396-4b07-af07-cae7bc8d1039';
-- General Other Building Equipment Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '5dbf2aea-6016-47f8-bc79-5a63b6a165eb';
-- General Nonresidential Property Managers (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '5f0c4077-370b-4237-b94c-3d7b95918ee3';
-- General Family Clothing Stores
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '629c090f-57cf-411b-877b-fc21b45d3123';
-- General Travel Trailer and Camper Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '6378ab15-3740-47a7-9efe-f385d64a3324';
-- New Custom Homes (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '63d1acc6-14ee-428c-933a-5a8bf41036d2';
-- General Other Personal and Household Goods Repair and Maintenance (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '63dd8b6d-5bb0-4cf3-abc3-b45d70051937';
-- Prosthetics (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '6528fd86-aa80-4345-b9e9-a5560bda479d';
-- General Wood Kitchen Cabinet and Countertop Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '67995db6-939f-4aa5-8542-c8e39c748805';
-- General Paint and Coating Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '6b2cfd97-7bb1-4afb-b02e-6de552268165';
-- Seasonal / Holiday Decor (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '6b97a13d-199a-4b7c-abdc-1b19e08b2660';
-- General Water Supply and Irrigation Systems (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '6d92dc98-47ef-426c-8ca2-ab32ed0c8f3e';
-- Outdoor Lighting (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '6ef62bb7-1cc4-4cea-931f-18be878e2492';
-- General Nail Salons (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '737acc35-98bf-4e88-8fe4-b69f192115e2';
-- General Metal Service Centers and Other Metal Merchant Wholesalers (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '745a3456-adb6-45a6-af06-41c7f874e21f';
-- General Sign Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '74623e36-9bab-4a16-997c-d67600700c67';
-- General Vending Machine Operators (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '7532b1ab-5b20-4cda-8dc2-831c07781179';
-- General Other Concrete Product Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '753a3087-c2eb-405a-a99a-5bd11225db38';
-- General Wood Preservation (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '7e465a13-c582-46a7-8518-39d8cdc4b1ff';
-- General Nursery, Garden Center, and Farm Supply Stores (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '80145706-8385-4fea-b64d-33be91dfada3';
-- Shed (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '807841c3-0806-473d-85d4-1590b074ef8f';
-- General Prefabricated Metal Building and Component Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '83dbc4a4-2e20-4638-94aa-89350c42fe56';
-- Mancave (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '84362e65-cc25-4666-b73a-45e3016f9c59';
-- General Wood Office Furniture Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '861cb1af-1391-40e0-9fe6-3f40c3fb3095';
-- General Wood Container and Pallet Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '87a59ce0-119d-4368-be37-0abcb1e2ae35';
-- General Women's, Children's, and Infants' Clothing and Accessories Merchant Wholesalers
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '87f9680e-ded7-4b70-971e-2698cecbc83c';
-- General Floor Covering Stores (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '88e65e9e-a0f5-4f1a-b96a-6cc1f4868192';
-- General Residential Property Managers (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '89f69293-19d4-4bbe-9596-51cdcc58b140';
-- General Household Appliances, Electric Housewares, and Consumer Electronics Merchant Wholesalers
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '8a5c04cd-967c-4b6b-a687-49fbcdf87421';
-- General Landscaping Services (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '8a5f7e33-619f-4d1f-a11f-3858730939cb';
-- General Other Activities Related to Real Estate (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '9219065e-e5c6-44cd-a0bf-2ac0d5e33d6a';
-- General Other Clothing Stores
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '98453e03-723e-4307-bf11-e8fd8cf7ce11';
-- Furniture (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = '995cd660-3206-4b61-bcaf-585d1b63fe1d';
-- Custom Tailoring (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = '9bd47915-5ca5-4822-a2c9-f15279bc66c3';
-- Custom Metal / Fabrication Visualization (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'a14cef38-cdef-4796-9b21-21090051aa16';
-- Nursery Design (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'a1c3a39c-9191-420b-80ed-af036e1e7fd7';
-- Patio & Deck Design (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'a244503a-336a-4df2-9683-10a69a937a64';
-- General Men's and Boys' Clothing and Furnishings Merchant Wholesalers
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'a29c586d-ea26-4205-81a9-0f7889965f0b';
-- Greenhouse (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'a2f365b7-407b-44d7-8246-08a0ff602493';
-- General Other Building Material Dealers (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'a348498d-b900-4522-8c0e-93dbf2c6e832';
-- General Paint, Varnish, and Supplies Merchant Wholesalers (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'a6914f6b-9e23-4ba1-997e-6d16dac20cb1';
-- General Plumbing Fixture Fitting and Trim Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'a7e9a3b9-842e-475f-bf28-267bac073a37';
-- Closet & Storage Solutions (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'a8268b67-2319-4245-aecc-268dbc7ca453';
-- General Ornamental and Architectural Metal Work Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'a86384a4-c2db-405b-b805-a371c0b19420';
-- Flooring (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'a8f8b785-7b31-4550-a64c-7b0ed786461e';
-- Nail color tryons (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'afaac42c-50ac-4ef6-9f7e-f2e93c72c249';
-- General Metal Window and Door Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'b069f6c4-3920-419d-9577-46ed2c918223';
-- Virtual Staging (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'b36128f1-bafc-43e8-8452-861542c81d74';
-- General Drywall and Insulation Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'b62dae40-26e9-4a3b-aad2-b877d2a3bc4e';
-- General Roofing, Siding, and Insulation Material Merchant Wholesalers (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'b6c0641c-3231-4a0c-a17a-6f27f74806c6';
-- All Accesories
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'b9325336-b720-4ee8-9153-0dae7f7323b1';
-- Makeup (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'bbb62e94-a02c-4514-96cf-fa0ebaa723c2';
-- General Leather and Hide Tanning and Finishing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'bbd1cbf4-2c87-45d1-9b10-a97fc2108ea8';
-- General Children's and Infants' Clothing Stores
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'bca6fbc7-a3f1-4526-929a-8561f96dd0e6';
-- General Mobile Food Services (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'bd084cf0-30f9-4e77-bdf6-4b503b1391f3';
-- Home Office (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'bd58738a-962a-4aeb-bd88-0605ac83a226';
-- General Soil Preparation, Planting, and Cultivating (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'bf502dba-2e70-4510-9a5d-4c22bb92b21a';
-- Stonework (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'c56f49fe-fe1b-42d7-8ea2-8303a8351f14';
-- General Siding Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'c6ecce3b-802c-49fc-8865-3f31ab4b707d';
-- General Electrical Contractors and Other Wiring Installation Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'c8d9d2f0-c916-4621-b60c-dcf6ade66ef6';
-- Wine Cellar (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'c8e0f738-3a28-4356-9bb8-e4a79d797423';
-- Home Theater Design (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'ca4f7e7f-44eb-41aa-a1a8-4af2e86dbe2f';
-- General Site Preparation Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'cf834de3-42fb-4aee-802f-d0540a770172';
-- Paving (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'd1cb23fe-b44d-42d4-b9e3-fbaceacbc4b0';
-- General Cut and Sew Apparel Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'd3364c94-24c5-4ea7-b910-7145032a0929';
-- General Structural Steel and Precast Concrete Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'd43b670a-9137-4130-aeee-ac8f9cea5645';
-- Airbnb Makeovers (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'd68e9534-33ff-48c4-a241-116f4165f88e';
-- General Reconstituted Wood Product Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'd6b800b9-8f92-4e56-a0de-1655d5a4df59';
-- Hot Tubs (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'd6bd55de-991b-4a0f-8e38-b0867b25658c';
-- Fence Design (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'd7882217-4653-4552-bd5f-ea50066c6b48';
-- Outdoor Kitchens (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'd8ae4da2-bd87-4b2c-a9e3-315b91f7eb56';
-- General Beauty Salons (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'd8e7248d-8cbe-45ca-934d-f17f9d14d5de';
-- General Custom Architectural Woodwork and Millwork Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'd972dc30-25e9-432e-bf0b-01e2685139e3';
-- General All Other Specialty Trade Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'dd4bf9a9-c72b-4b14-a97f-279866d7a6ed';
-- General Roofing Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'de905130-fef8-4fd1-9009-adc5fcb450c5';
-- Outdoor Furniture Layout (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'dec93c29-03c8-4aa5-a9cf-5ec4d4e005c0';
-- General Paint and Wallpaper Stores (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'df08d1ce-d732-4631-b90e-03cad4f54ee8';
-- Paint & Wallpaper (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'dfde7a02-087d-4351-a803-10fca6d95fc5';
-- General Lumber, Plywood, Millwork, and Wood Panel Merchant Wholesalers (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'e1bda2e9-b136-4038-869e-530160b63ecf';
-- General Ready-Mix Concrete Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'e2395894-2771-4b28-ba34-1eab215c5efa';
-- General Women's Clothing Stores
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'e26b09d6-af65-4da1-9f12-01c4e15b01fb';
-- Door & Garage Door Design (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'e38d899b-250f-481c-bbd2-0f9a539a894f';
-- General Tile and Terrazzo Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'e60f9e47-8a71-44ae-a085-54678b0dfbb9';
-- General Outdoor Advertising (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'e8535c23-70ff-4182-86da-4996d35cd9a4';
-- General Metal Household Furniture Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'eaacfd99-649e-432e-88cd-ed62d74c12b3';
-- Recreational Sports Area (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'eb84e0f3-5e54-424a-bbdd-624a4608a30d';
-- Lighting & Smart Lighting (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'ebd03f10-8166-44cc-805e-f43ad7455c49';
-- Land / Lot Planning (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'ee508079-056d-4feb-b423-a95f4d014bf6';
-- General Residential Electric Lighting Fixture Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'ee5dc244-b640-4849-a04c-9a7c1949d12f';
-- General Women's Handbag and Purse Manufacturing
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'efc8de09-8a2c-44d3-a6e9-991f0538b55b';
-- General Shoe Stores
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'f0abcfb3-50cc-4b84-859a-d018a95a1dbf';
-- General Used Merchandise Stores
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'f0f64155-a17b-4890-b50d-c86655b31be7';
-- General Glass and Glazing Contractors (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'f211501a-4541-44e9-ab26-16874ab7c4ba';
-- Hair Styling & Color (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'f48fbd45-76a2-4da8-8136-bb03756608dd';
-- General Commercial, Industrial, and Institutional Electric Lighting Fixture Manufacturing (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'try-on' WHERE id = 'f5f176e1-3cac-473b-9f4d-6ed7361b7d30';
-- General Highway, Street, and Bridge Construction (E-commerce)
UPDATE public.categories_subcategories SET ai_model_category = 'scene-placement' WHERE id = 'f6439b54-ced4-436e-aeea-0c22833b5de6';
COMMIT;
