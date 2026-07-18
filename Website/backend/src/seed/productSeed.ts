import { connectDB, disconnectDB } from "../config/db.js";
import { CategoryModel } from "../models/Category.js";
import { ProductModel } from "../models/Product.js";
import { slugify } from "../utils/slugify.js";

/**
 * Seeds demo categories + products for the four departments with realistic
 * Indian pricing. Idempotent: wipes existing products/categories and re-inserts
 * so you always get a clean, known dataset. (Run: npm run seed:products)
 */

interface SeedProduct {
  title: string;
  brand: string;
  description: string;
  price: number;
  mrp: number;
  stock: number;
  rating: number;
  numReviews: number;
  gstRate: number;
  weight: number;
  tags: string[];
  specifications: Record<string, string>;
  bulkPricing?: { minQty: number; pricePerUnit: number }[];
}

const img = (slug: string, n: number) => `https://picsum.photos/seed/${slug}-${n}/700/700`;

const CATEGORIES = [
  { name: "Tiles", image: "https://picsum.photos/seed/cat-tiles/600/400", order: 1 },
  { name: "Paints", image: "https://picsum.photos/seed/cat-paints/600/400", order: 2 },
  { name: "Electrical", image: "https://picsum.photos/seed/cat-electrical/600/400", order: 3 },
  { name: "Home Interiors", image: "https://picsum.photos/seed/cat-interiors/600/400", order: 4 },
];

const TILES: SeedProduct[] = [
  { title: "Kajaria Vitrified Floor Tiles 600x600mm", brand: "Kajaria", description: "Premium double-charged vitrified floor tiles with a glossy finish, ideal for living rooms and halls.", price: 48, mrp: 65, stock: 1200, rating: 4.4, numReviews: 132, gstRate: 18, weight: 3.2, tags: ["floor", "vitrified", "glossy", "tiles"], specifications: { Size: "600x600 mm", Finish: "Glossy", Material: "Vitrified", "Coverage/Box": "1.44 sqm", PiecesPerBox: "4" }, bulkPricing: [{ minQty: 50, pricePerUnit: 45 }, { minQty: 200, pricePerUnit: 42 }] },
  { title: "Somany Glossy Ceramic Wall Tiles 300x600mm", brand: "Somany", description: "Designer ceramic wall tiles for kitchens and bathrooms with a premium glossy surface.", price: 38, mrp: 52, stock: 900, rating: 4.2, numReviews: 88, gstRate: 18, weight: 2.4, tags: ["wall", "ceramic", "kitchen", "bathroom"], specifications: { Size: "300x600 mm", Finish: "Glossy", Material: "Ceramic", Application: "Wall" }, bulkPricing: [{ minQty: 50, pricePerUnit: 35 }] },
  { title: "Nitco Marble Finish Vitrified Tiles 800x800mm", brand: "Nitco", description: "Large-format marble-look vitrified tiles that bring a luxurious stone aesthetic.", price: 72, mrp: 95, stock: 600, rating: 4.5, numReviews: 64, gstRate: 18, weight: 5.0, tags: ["floor", "marble", "vitrified", "premium"], specifications: { Size: "800x800 mm", Finish: "Polished", Material: "Vitrified", Look: "Marble" } },
  { title: "Johnson Anti-Skid Bathroom Floor Tiles 300x300mm", brand: "H&R Johnson", description: "Matte anti-skid tiles engineered for wet areas and bathroom floors.", price: 32, mrp: 44, stock: 1500, rating: 4.1, numReviews: 121, gstRate: 18, weight: 1.6, tags: ["floor", "anti-skid", "bathroom", "matte"], specifications: { Size: "300x300 mm", Finish: "Matte", AntiSkid: "Yes", Application: "Bathroom Floor" } },
  { title: "Kajaria Wooden Plank Vitrified Tiles 200x1200mm", brand: "Kajaria", description: "Wood-grain plank tiles offering the warmth of wood with the durability of vitrified tile.", price: 65, mrp: 85, stock: 700, rating: 4.6, numReviews: 73, gstRate: 18, weight: 3.8, tags: ["floor", "wooden", "plank", "vitrified"], specifications: { Size: "200x1200 mm", Finish: "Wood Grain", Material: "Vitrified" } },
  { title: "Orient Bell Matt Finish Floor Tiles 600x600mm", brand: "Orient Bell", description: "Slip-resistant matt finish floor tiles suitable for high-traffic areas.", price: 42, mrp: 58, stock: 1000, rating: 4.0, numReviews: 54, gstRate: 18, weight: 3.1, tags: ["floor", "matte", "tiles"], specifications: { Size: "600x600 mm", Finish: "Matt", Material: "Vitrified" } },
  { title: "Somany Designer Kitchen Wall Tiles 300x450mm", brand: "Somany", description: "Decorative highlighter wall tiles to elevate kitchen backsplashes.", price: 34, mrp: 49, stock: 820, rating: 4.3, numReviews: 47, gstRate: 18, weight: 2.0, tags: ["wall", "kitchen", "designer"], specifications: { Size: "300x450 mm", Finish: "Glossy", Application: "Kitchen Wall" } },
  { title: "Kajaria Double Charged Vitrified Tiles 600x1200mm", brand: "Kajaria", description: "Heavy-duty double-charged vitrified tiles for commercial and residential flooring.", price: 78, mrp: 99, stock: 540, rating: 4.7, numReviews: 39, gstRate: 18, weight: 6.5, tags: ["floor", "vitrified", "heavy-duty", "premium"], specifications: { Size: "600x1200 mm", Finish: "Polished", Type: "Double Charged" }, bulkPricing: [{ minQty: 100, pricePerUnit: 74 }] },
  { title: "Somany Granite Look Outdoor Tiles 600x600mm", brand: "Somany", description: "Rugged granite-finish tiles built for balconies, terraces and outdoor walkways.", price: 55, mrp: 74, stock: 800, rating: 4.3, numReviews: 61, gstRate: 18, weight: 3.6, tags: ["outdoor", "granite", "terrace", "tiles"], specifications: { Size: "600x600 mm", Finish: "Rustic Matt", Application: "Outdoor", Look: "Granite" } },
  { title: "Nitco Hexagonal Designer Floor Tiles 200x230mm", brand: "Nitco", description: "Trendy hexagon tiles for statement floors in cafes, kitchens and foyers.", price: 58, mrp: 79, stock: 450, rating: 4.4, numReviews: 27, gstRate: 18, weight: 1.2, tags: ["hexagon", "designer", "floor", "statement"], specifications: { Size: "200x230 mm", Shape: "Hexagon", Finish: "Matt", Material: "Vitrified" } },
  { title: "Johnson Endura Parking Tiles 300x300mm", brand: "H&R Johnson", description: "Extra-tough heavy-load parking tiles with anti-skid checkered surface.", price: 36, mrp: 48, stock: 1800, rating: 4.2, numReviews: 103, gstRate: 18, weight: 2.1, tags: ["parking", "heavy-duty", "anti-skid", "outdoor"], specifications: { Size: "300x300 mm", Finish: "Checkered", LoadBearing: "Heavy", AntiSkid: "Yes" }, bulkPricing: [{ minQty: 100, pricePerUnit: 33 }] },
  { title: "Orient Bell Moroccan Pattern Wall Tiles 300x300mm", brand: "Orient Bell", description: "Hand-crafted look Moroccan pattern tiles for feature walls and backsplashes.", price: 46, mrp: 64, stock: 520, rating: 4.5, numReviews: 45, gstRate: 18, weight: 1.5, tags: ["moroccan", "pattern", "wall", "designer"], specifications: { Size: "300x300 mm", Pattern: "Moroccan", Finish: "Matt", Application: "Wall" } },
  { title: "Kajaria Eternity Grey Stone Tiles 600x600mm", brand: "Kajaria", description: "Contemporary grey stone-effect tiles for modern minimalist interiors.", price: 52, mrp: 69, stock: 760, rating: 4.3, numReviews: 52, gstRate: 18, weight: 3.3, tags: ["stone", "grey", "modern", "floor"], specifications: { Size: "600x600 mm", Look: "Stone", Colour: "Grey", Finish: "Matt" } },
  { title: "Somany Mosaic Swimming Pool Tiles 25x25mm Sheet", brand: "Somany", description: "Water-resistant glass mosaic tile sheets in ocean blue for pools and fountains.", price: 145, mrp: 190, stock: 380, rating: 4.6, numReviews: 22, gstRate: 18, weight: 1.0, tags: ["mosaic", "pool", "blue", "glass"], specifications: { ChipSize: "25x25 mm", SheetSize: "300x300 mm", Material: "Glass Mosaic", Colour: "Ocean Blue" } },
  { title: "Nitco Terracotta Roof Tiles (Pack of 10)", brand: "Nitco", description: "Classic clay terracotta roof tiles offering natural cooling and timeless charm.", price: 480, mrp: 620, stock: 300, rating: 4.1, numReviews: 34, gstRate: 18, weight: 18, tags: ["roof", "terracotta", "clay", "cooling"], specifications: { Pieces: "10", Material: "Clay", Colour: "Terracotta Red", Application: "Roofing" } },
  { title: "Johnson Marbonite Ivory Tiles 800x1600mm", brand: "H&R Johnson", description: "Ultra-large slim ivory tiles that create seamless luxury floors with minimal joints.", price: 118, mrp: 155, stock: 260, rating: 4.7, numReviews: 19, gstRate: 18, weight: 8.2, tags: ["large-format", "ivory", "luxury", "slim"], specifications: { Size: "800x1600 mm", Finish: "Glossy", Colour: "Ivory", Thickness: "9 mm" }, bulkPricing: [{ minQty: 50, pricePerUnit: 112 }] },
  { title: "Orient Bell 3D Elevation Tiles 300x600mm", brand: "Orient Bell", description: "Textured 3D elevation tiles that give building exteriors a bold facade.", price: 49, mrp: 66, stock: 640, rating: 4.2, numReviews: 41, gstRate: 18, weight: 2.6, tags: ["elevation", "3d", "exterior", "facade"], specifications: { Size: "300x600 mm", Finish: "3D Textured", Application: "Exterior Wall" } },
  { title: "Kajaria Kitchen Highlighter Border Tiles 100x600mm", brand: "Kajaria", description: "Slim decorative border tiles to accent kitchen and bathroom wall layouts.", price: 28, mrp: 40, stock: 950, rating: 4.0, numReviews: 30, gstRate: 18, weight: 0.6, tags: ["border", "highlighter", "kitchen", "accent"], specifications: { Size: "100x600 mm", Finish: "Glossy", Application: "Wall Border" } },
];

const PAINTS: SeedProduct[] = [
  { title: "Asian Paints Royale Luxury Emulsion 20L", brand: "Asian Paints", description: "Premium interior emulsion with a rich, smooth finish and superior washability.", price: 7200, mrp: 8500, stock: 220, rating: 4.6, numReviews: 210, gstRate: 18, weight: 24, tags: ["interior", "emulsion", "luxury", "washable"], specifications: { Volume: "20 L", Finish: "Smooth Matt", Coverage: "Up to 1600 sqft", Type: "Interior Emulsion" }, bulkPricing: [{ minQty: 5, pricePerUnit: 7000 }] },
  { title: "Berger Silk Glamor Interior Emulsion 10L", brand: "Berger", description: "Silky-smooth, high-sheen interior emulsion with excellent stain resistance.", price: 3850, mrp: 4600, stock: 180, rating: 4.4, numReviews: 95, gstRate: 18, weight: 12, tags: ["interior", "emulsion", "silk"], specifications: { Volume: "10 L", Finish: "Silk Sheen", Type: "Interior Emulsion" } },
  { title: "Nerolac Beauty Smooth Finish 4L", brand: "Nerolac", description: "Smooth matt interior wall paint with low odour and easy application.", price: 1480, mrp: 1850, stock: 300, rating: 4.2, numReviews: 76, gstRate: 18, weight: 5, tags: ["interior", "matt", "smooth"], specifications: { Volume: "4 L", Finish: "Matt", Type: "Interior Emulsion" } },
  { title: "Dulux Velvet Touch Pearl Glo 1L", brand: "Dulux", description: "Ultra-smooth luxury emulsion with a soft pearl glow for premium interiors.", price: 520, mrp: 660, stock: 400, rating: 4.5, numReviews: 58, gstRate: 18, weight: 1.3, tags: ["interior", "luxury", "pearl"], specifications: { Volume: "1 L", Finish: "Pearl", Type: "Interior Emulsion" } },
  { title: "Asian Paints Apex Weatherproof Exterior 20L", brand: "Asian Paints", description: "Long-lasting exterior emulsion with all-weather protection and anti-algal properties.", price: 5400, mrp: 6500, stock: 160, rating: 4.5, numReviews: 134, gstRate: 18, weight: 25, tags: ["exterior", "weatherproof", "emulsion"], specifications: { Volume: "20 L", Finish: "Matt", Type: "Exterior Emulsion", Protection: "All Weather" }, bulkPricing: [{ minQty: 5, pricePerUnit: 5200 }] },
  { title: "Berger WeatherCoat Anti Dust Exterior 10L", brand: "Berger", description: "Dust-resistant exterior paint that keeps walls cleaner for longer.", price: 2950, mrp: 3600, stock: 140, rating: 4.3, numReviews: 67, gstRate: 18, weight: 12.5, tags: ["exterior", "anti-dust", "weathercoat"], specifications: { Volume: "10 L", Finish: "Smooth", Type: "Exterior Emulsion" } },
  { title: "Asian Paints TruCare Wall Primer 4L", brand: "Asian Paints", description: "Water-based interior wall primer for a strong, uniform paint base.", price: 640, mrp: 820, stock: 350, rating: 4.1, numReviews: 41, gstRate: 18, weight: 5, tags: ["primer", "interior", "base-coat"], specifications: { Volume: "4 L", Type: "Water-Based Primer" } },
  { title: "Nerolac Impressions Ceiling White 20L", brand: "Nerolac", description: "Bright, smooth ceiling emulsion specially formulated for overhead surfaces.", price: 2600, mrp: 3200, stock: 130, rating: 4.0, numReviews: 33, gstRate: 18, weight: 24, tags: ["ceiling", "white", "emulsion"], specifications: { Volume: "20 L", Finish: "Matt", Colour: "White", Type: "Ceiling Emulsion" } },
  { title: "Asian Paints Royale Play Metallics 1L", brand: "Asian Paints", description: "Special-effect metallic wall paint for designer accent walls and textures.", price: 950, mrp: 1200, stock: 210, rating: 4.5, numReviews: 62, gstRate: 18, weight: 1.3, tags: ["metallic", "texture", "accent", "designer"], specifications: { Volume: "1 L", Finish: "Metallic", Type: "Special Effect", Application: "Accent Wall" } },
  { title: "Berger Easy Clean Washable Emulsion 10L", brand: "Berger", description: "Stain-repelling interior emulsion — crayon and food marks wipe off with water.", price: 3200, mrp: 3950, stock: 190, rating: 4.4, numReviews: 118, gstRate: 18, weight: 12, tags: ["washable", "interior", "kids-friendly", "emulsion"], specifications: { Volume: "10 L", Finish: "Soft Sheen", StainRepellent: "Yes", Type: "Interior Emulsion" }, bulkPricing: [{ minQty: 5, pricePerUnit: 3080 }] },
  { title: "Dulux Weathershield Max Exterior 10L", brand: "Dulux", description: "Premium exterior paint with Sun-Reflect technology that keeps walls cooler.", price: 3650, mrp: 4400, stock: 120, rating: 4.6, numReviews: 84, gstRate: 18, weight: 12.8, tags: ["exterior", "weathershield", "heat-reflect"], specifications: { Volume: "10 L", Finish: "Sheen", Technology: "Sun-Reflect", Type: "Exterior Emulsion" } },
  { title: "Nerolac Excel Rainguard Waterproof 20L", brand: "Nerolac", description: "Waterproofing exterior emulsion with silicon that fights heavy monsoon rains.", price: 5100, mrp: 6300, stock: 110, rating: 4.4, numReviews: 71, gstRate: 18, weight: 25, tags: ["waterproof", "exterior", "monsoon", "silicon"], specifications: { Volume: "20 L", Waterproof: "Yes", Additive: "Silicon", Type: "Exterior Emulsion" }, bulkPricing: [{ minQty: 4, pricePerUnit: 4950 }] },
  { title: "Asian Paints Apcolite Premium Enamel 4L", brand: "Asian Paints", description: "High-gloss synthetic enamel for doors, windows, grills and metal surfaces.", price: 1350, mrp: 1680, stock: 280, rating: 4.3, numReviews: 93, gstRate: 18, weight: 4.8, tags: ["enamel", "gloss", "metal", "wood"], specifications: { Volume: "4 L", Finish: "High Gloss", Surface: "Metal & Wood", Type: "Synthetic Enamel" } },
  { title: "Berger Jadoo Anti-Rust Metal Primer 1L", brand: "Berger", description: "Red-oxide anti-rust primer that protects iron gates, grills and railings.", price: 320, mrp: 420, stock: 420, rating: 4.1, numReviews: 39, gstRate: 18, weight: 1.4, tags: ["primer", "anti-rust", "metal", "red-oxide"], specifications: { Volume: "1 L", Type: "Metal Primer", AntiRust: "Yes", Colour: "Red Oxide" } },
  { title: "Dulux Aquatech Waterproof Basement Coating 20kg", brand: "Dulux", description: "Two-component waterproof coating for basements, terraces and water tanks.", price: 4800, mrp: 5900, stock: 90, rating: 4.5, numReviews: 28, gstRate: 18, weight: 21, tags: ["waterproofing", "basement", "terrace", "coating"], specifications: { Weight: "20 kg", Components: "2", Application: "Basement/Terrace/Tank" } },
  { title: "Nerolac Wood Polish Melamine Glossy 1L", brand: "Nerolac", description: "Clear melamine wood finish that enhances grain with a rich glossy sheen.", price: 580, mrp: 740, stock: 240, rating: 4.2, numReviews: 45, gstRate: 18, weight: 1.1, tags: ["wood-polish", "melamine", "furniture", "glossy"], specifications: { Volume: "1 L", Finish: "Glossy", Type: "Melamine", Surface: "Wood" } },
  { title: "Asian Paints SmartCare Damp Proof 20L", brand: "Asian Paints", description: "Fibre-reinforced elastomeric waterproof coating for roofs with 8-year warranty.", price: 6200, mrp: 7500, stock: 100, rating: 4.6, numReviews: 106, gstRate: 18, weight: 26, tags: ["damp-proof", "roof", "waterproof", "elastomeric"], specifications: { Volume: "20 L", Warranty: "8 Years", Type: "Elastomeric Coating", Fibre: "Reinforced" }, bulkPricing: [{ minQty: 3, pricePerUnit: 6000 }] },
  { title: "Berger Bison Acrylic Distemper 10kg", brand: "Berger", description: "Budget-friendly acrylic distemper with smooth matt finish for rental and utility spaces.", price: 780, mrp: 990, stock: 380, rating: 4.0, numReviews: 52, gstRate: 18, weight: 10.5, tags: ["distemper", "budget", "interior", "matt"], specifications: { Weight: "10 kg", Finish: "Matt", Type: "Acrylic Distemper" }, bulkPricing: [{ minQty: 10, pricePerUnit: 740 }] },
];

const ELECTRICAL: SeedProduct[] = [
  { title: "Anchor Roma Modular Switch Board (8 Module)", brand: "Anchor", description: "Complete 8-module modular switch board with plate and frame for clean wall fittings.", price: 540, mrp: 780, stock: 500, rating: 4.3, numReviews: 152, gstRate: 18, weight: 0.6, tags: ["switch", "modular", "switchboard", "roma"], specifications: { Modules: "8", Series: "Roma", Includes: "Plate + Frame", Colour: "White" }, bulkPricing: [{ minQty: 10, pricePerUnit: 510 }] },
  { title: "Havells LED Panel Light 18W Round", brand: "Havells", description: "Slim recessed LED panel light with uniform glare-free illumination.", price: 420, mrp: 590, stock: 640, rating: 4.4, numReviews: 98, gstRate: 18, weight: 0.4, tags: ["led", "panel", "light", "ceiling"], specifications: { Wattage: "18 W", Shape: "Round", ColourTemp: "6500K Cool White", Type: "Recessed Panel" } },
  { title: "Polycab FR PVC Insulated Wire 1.5 sqmm (90m)", brand: "Polycab", description: "Flame-retardant copper house wiring cable for safe domestic installations.", price: 1180, mrp: 1480, stock: 380, rating: 4.6, numReviews: 187, gstRate: 18, weight: 1.8, tags: ["wire", "cable", "copper", "fr"], specifications: { Size: "1.5 sqmm", Length: "90 m", Type: "FR PVC", Conductor: "Copper" }, bulkPricing: [{ minQty: 10, pricePerUnit: 1130 }] },
  { title: "Legrand Myrius Modular Switch 6A", brand: "Legrand", description: "Premium 6A one-way modular switch with smooth operation and elegant design.", price: 95, mrp: 140, stock: 1200, rating: 4.2, numReviews: 64, gstRate: 18, weight: 0.05, tags: ["switch", "modular", "myrius"], specifications: { Rating: "6 A", Type: "One Way", Series: "Myrius" } },
  { title: "Wipro Garnet LED Bulb 9W (Pack of 4)", brand: "Wipro", description: "Energy-efficient 9W LED bulbs with long life and bright cool daylight.", price: 360, mrp: 520, stock: 900, rating: 4.3, numReviews: 142, gstRate: 12, weight: 0.3, tags: ["led", "bulb", "energy-saving"], specifications: { Wattage: "9 W", Pack: "4", Base: "B22", ColourTemp: "6500K" } },
  { title: "Havells MCB 32A Single Pole C-Curve", brand: "Havells", description: "Miniature circuit breaker for reliable overload and short-circuit protection.", price: 230, mrp: 320, stock: 460, rating: 4.5, numReviews: 51, gstRate: 18, weight: 0.12, tags: ["mcb", "breaker", "protection"], specifications: { Current: "32 A", Poles: "Single", Curve: "C", BreakingCapacity: "10 kA" } },
  { title: "Anchor Penta High-Speed Ceiling Fan 1200mm", brand: "Anchor", description: "High-speed 1200mm ceiling fan with aerodynamic blades and durable motor.", price: 1650, mrp: 2200, stock: 240, rating: 4.1, numReviews: 89, gstRate: 18, weight: 4.5, tags: ["fan", "ceiling", "high-speed"], specifications: { Sweep: "1200 mm", Speed: "380 RPM", Warranty: "2 Years" } },
  { title: "Finolex Heat Resistant Wire 2.5 sqmm (90m)", brand: "Finolex", description: "Heat-resistant copper wire suited for power points and heavy appliances.", price: 1890, mrp: 2350, stock: 300, rating: 4.5, numReviews: 76, gstRate: 18, weight: 2.6, tags: ["wire", "cable", "copper", "2.5sqmm"], specifications: { Size: "2.5 sqmm", Length: "90 m", Conductor: "Copper", HeatResistant: "Yes" } },
  { title: "Havells Instanio 3L Instant Water Geyser", brand: "Havells", description: "Compact 3-litre instant water heater with rust-proof ABS body for kitchens.", price: 3450, mrp: 4390, stock: 180, rating: 4.4, numReviews: 132, gstRate: 18, weight: 3.6, tags: ["geyser", "water-heater", "instant", "kitchen"], specifications: { Capacity: "3 L", Wattage: "3000 W", Body: "ABS Rust-Proof", Warranty: "5 Years (Tank)" } },
  { title: "Anchor Smart WiFi Switch 16A (Alexa Compatible)", brand: "Anchor", description: "Convert any appliance into a smart device — app control, timers, voice assistant.", price: 1150, mrp: 1499, stock: 260, rating: 4.2, numReviews: 58, gstRate: 18, weight: 0.1, tags: ["smart", "wifi", "alexa", "switch"], specifications: { Rating: "16 A", App: "Yes", VoiceControl: "Alexa / Google", Protocol: "WiFi 2.4GHz" } },
  { title: "Polycab Etira LED Batten 20W 4ft", brand: "Polycab", description: "Slim LED tube-light batten with even, flicker-free brightness for homes and shops.", price: 340, mrp: 470, stock: 720, rating: 4.3, numReviews: 89, gstRate: 18, weight: 0.5, tags: ["led", "batten", "tubelight", "4ft"], specifications: { Wattage: "20 W", Length: "4 ft", ColourTemp: "6500K", Lumens: "2000 lm" }, bulkPricing: [{ minQty: 10, pricePerUnit: 320 }] },
  { title: "Legrand 6-Way SPN Distribution Board", brand: "Legrand", description: "Metal-clad MCB distribution box with acrylic door for tidy home wiring panels.", price: 980, mrp: 1350, stock: 210, rating: 4.4, numReviews: 43, gstRate: 18, weight: 1.8, tags: ["distribution-board", "mcb-box", "spn", "panel"], specifications: { Ways: "6", Type: "SPN", Door: "Acrylic", Material: "Metal Clad" } },
  { title: "Wipro Smart LED Strip Light 5m (WiFi RGB)", brand: "Wipro", description: "16-million colour app-controlled LED strip for TV units, ceilings and decor.", price: 1250, mrp: 1800, stock: 330, rating: 4.3, numReviews: 97, gstRate: 18, weight: 0.4, tags: ["led-strip", "rgb", "smart", "decor"], specifications: { Length: "5 m", Colours: "RGB 16M", Control: "App + Voice", Adapter: "Included" } },
  { title: "Havells 25A DP MCB Isolator", brand: "Havells", description: "Double-pole isolator switch for ACs, geysers and heavy appliance circuits.", price: 310, mrp: 420, stock: 400, rating: 4.5, numReviews: 37, gstRate: 18, weight: 0.15, tags: ["isolator", "dp", "mcb", "ac"], specifications: { Current: "25 A", Poles: "Double", Application: "AC / Geyser" } },
  { title: "Anchor Roma 2-Module USB Charger Socket", brand: "Anchor", description: "In-wall dual USB fast-charging socket — no adapter needed at bedside or desks.", price: 620, mrp: 850, stock: 350, rating: 4.2, numReviews: 66, gstRate: 18, weight: 0.08, tags: ["usb", "socket", "charger", "modular"], specifications: { Ports: "2 USB-A", Output: "3.1A Shared", Series: "Roma", Modules: "2" } },
  { title: "Polycab 4-Core Flat Submersible Cable 1.5 sqmm (100m)", brand: "Polycab", description: "Water-resistant flat cable for borewell submersible pump connections.", price: 4200, mrp: 5100, stock: 140, rating: 4.6, numReviews: 29, gstRate: 18, weight: 9.5, tags: ["submersible", "cable", "borewell", "flat"], specifications: { Cores: "4", Size: "1.5 sqmm", Length: "100 m", Type: "Flat Submersible" }, bulkPricing: [{ minQty: 5, pricePerUnit: 4050 }] },
  { title: "Legrand Arteor Motion Sensor Light Switch", brand: "Legrand", description: "Auto on/off PIR motion sensor switch — lights turn on when you enter the room.", price: 1480, mrp: 1950, stock: 190, rating: 4.4, numReviews: 31, gstRate: 18, weight: 0.09, tags: ["motion-sensor", "pir", "auto", "energy-saving"], specifications: { Sensor: "PIR", Range: "8 m", TimeDelay: "Adjustable", Series: "Arteor" } },
  { title: "Wipro Rechargeable Emergency LED Light 36W", brand: "Wipro", description: "Auto-on inverter LED light with 4-hour backup for power cuts.", price: 890, mrp: 1250, stock: 310, rating: 4.2, numReviews: 74, gstRate: 18, weight: 0.7, tags: ["emergency", "rechargeable", "inverter-bulb", "backup"], specifications: { Wattage: "36 W", Backup: "4 Hours", Charging: "Auto", Battery: "Li-ion" } },
];

const INTERIORS: SeedProduct[] = [
  { title: "Decorative PVC Wall Panels (Set of 6)", brand: "Generic", description: "Waterproof 3D PVC wall panels for quick, glue-on interior wall makeovers.", price: 1450, mrp: 2100, stock: 320, rating: 4.2, numReviews: 73, gstRate: 18, weight: 5.5, tags: ["wall-panel", "pvc", "decor", "3d"], specifications: { Pieces: "6", PanelSize: "1ft x 2ft", Material: "PVC", Waterproof: "Yes" }, bulkPricing: [{ minQty: 5, pricePerUnit: 1380 }] },
  { title: "Engineered Wooden Wall Shelf Set (3 Shelves)", brand: "HomeCraft", description: "Floating wooden display shelves with concealed mounting for a clean look.", price: 990, mrp: 1499, stock: 410, rating: 4.3, numReviews: 58, gstRate: 18, weight: 3.0, tags: ["shelf", "wooden", "wall-decor", "storage"], specifications: { Pieces: "3", Material: "Engineered Wood", Mounting: "Concealed" } },
  { title: "Premium Blackout Window Curtains (Pair)", brand: "DecorNest", description: "Room-darkening polyester curtains that reduce heat and block light.", price: 850, mrp: 1300, stock: 520, rating: 4.1, numReviews: 96, gstRate: 12, weight: 1.4, tags: ["curtain", "blackout", "window", "decor"], specifications: { Pieces: "2", Size: "4ft x 7ft", Material: "Polyester", Type: "Blackout" } },
  { title: "Modular Kitchen Cabinet Handle Set (10 Pcs)", brand: "Ebco", description: "Stainless steel cabinet and drawer handles with a brushed satin finish.", price: 720, mrp: 1050, stock: 380, rating: 4.4, numReviews: 47, gstRate: 18, weight: 1.2, tags: ["handle", "kitchen", "hardware", "modular"], specifications: { Pieces: "10", Material: "Stainless Steel", Finish: "Brushed Satin" } },
  { title: "Gypsum False Ceiling Panel 2x2 ft (Pack of 8)", brand: "Saint-Gobain", description: "Lightweight gypsum tiles for elegant grid false ceilings.", price: 1280, mrp: 1700, stock: 260, rating: 4.0, numReviews: 32, gstRate: 18, weight: 9.0, tags: ["false-ceiling", "gypsum", "panel"], specifications: { Pieces: "8", Size: "2x2 ft", Material: "Gypsum" } },
  { title: "Vinyl Wooden Flooring Roll (per sqm)", brand: "Greenlam", description: "Self-adhesive vinyl plank flooring with realistic wood texture, easy DIY install.", price: 240, mrp: 360, stock: 1500, rating: 4.2, numReviews: 81, gstRate: 18, weight: 2.2, tags: ["flooring", "vinyl", "wooden", "diy"], specifications: { Coverage: "1 sqm", Thickness: "2 mm", Type: "Self-Adhesive Vinyl" }, bulkPricing: [{ minQty: 20, pricePerUnit: 225 }, { minQty: 50, pricePerUnit: 210 }] },
  { title: "Designer Textured Wallpaper Roll (5.3 sqm)", brand: "Marshalls", description: "Premium non-woven textured wallpaper for accent walls and living spaces.", price: 1100, mrp: 1600, stock: 340, rating: 4.3, numReviews: 44, gstRate: 12, weight: 1.1, tags: ["wallpaper", "textured", "decor", "accent"], specifications: { Coverage: "5.3 sqm", Material: "Non-Woven", RollSize: "0.53m x 10m" } },
  { title: "LED Backlit Bathroom Mirror 24x18 inch", brand: "Glow&Co", description: "Anti-fog LED mirror with touch sensor and warm/cool light modes.", price: 3200, mrp: 4500, stock: 150, rating: 4.5, numReviews: 38, gstRate: 18, weight: 6.0, tags: ["mirror", "led", "bathroom", "anti-fog"], specifications: { Size: "24x18 inch", Lighting: "LED Backlit", AntiFog: "Yes", Control: "Touch Sensor" } },
  { title: "Sliding Wardrobe Door Kit 6ft (Soft Close)", brand: "Ebco", description: "Complete sliding-door hardware kit with soft-close dampers for wardrobes.", price: 2850, mrp: 3900, stock: 170, rating: 4.4, numReviews: 42, gstRate: 18, weight: 7.5, tags: ["wardrobe", "sliding", "soft-close", "hardware"], specifications: { TrackLength: "6 ft", SoftClose: "Yes", LoadCapacity: "80 kg", Doors: "2" } },
  { title: "Artificial Green Wall Panel 50x50cm (Set of 4)", brand: "DecorNest", description: "UV-protected artificial vertical garden panels for balconies and feature walls.", price: 1180, mrp: 1650, stock: 290, rating: 4.2, numReviews: 55, gstRate: 12, tags: ["green-wall", "artificial", "balcony", "vertical-garden"], weight: 2.8, specifications: { Pieces: "4", PanelSize: "50x50 cm", UVProtected: "Yes", Material: "PE Plastic" }, bulkPricing: [{ minQty: 8, pricePerUnit: 1100 }] },
  { title: "Teak Finish Solid Wood Main Door 7x3ft", brand: "HomeCraft", description: "Engineered solid-core main door with teak veneer and carved panel design.", price: 8900, mrp: 11500, stock: 60, rating: 4.6, numReviews: 24, gstRate: 18, weight: 42, tags: ["door", "main-door", "teak", "wooden"], specifications: { Size: "7x3 ft", Core: "Solid Engineered", Veneer: "Teak", Design: "Carved Panel" } },
  { title: "Stainless Steel Kitchen Sink 24x18 inch (Single Bowl)", brand: "Nirali", description: "Satin-finish SS-304 kitchen sink with anti-scratch coating and waste coupling.", price: 2450, mrp: 3200, stock: 200, rating: 4.3, numReviews: 78, gstRate: 18, weight: 4.5, tags: ["sink", "kitchen", "stainless-steel", "single-bowl"], specifications: { Size: "24x18 inch", Grade: "SS-304", Bowl: "Single", Finish: "Satin" } },
  { title: "Aluminium Modular Kitchen Basket Set (5 Pcs)", brand: "Ebco", description: "Rust-free aluminium wire baskets — plate, cutlery, thali and bottle organisers.", price: 3600, mrp: 4800, stock: 130, rating: 4.4, numReviews: 36, gstRate: 18, weight: 6.2, tags: ["kitchen-basket", "modular", "aluminium", "organizer"], specifications: { Pieces: "5", Material: "Aluminium", Types: "Plate/Cutlery/Thali/Bottle", RustFree: "Yes" } },
  { title: "Roman Blinds Window Shade 4x5ft (Custom Fabric)", brand: "DecorNest", description: "Elegant cord-operated roman blinds in premium jute-blend fabric.", price: 1650, mrp: 2300, stock: 240, rating: 4.1, numReviews: 47, gstRate: 12, weight: 1.8, tags: ["blinds", "roman", "window", "jute"], specifications: { Size: "4x5 ft", Fabric: "Jute Blend", Operation: "Cord", Mount: "Wall/Ceiling" } },
  { title: "PVC Ceiling Cornice Moulding 8ft (Pack of 6)", brand: "Saint-Gobain", description: "Lightweight decorative cornice strips for ceiling borders — paintable finish.", price: 1440, mrp: 1920, stock: 310, rating: 4.0, numReviews: 26, gstRate: 18, weight: 4.8, tags: ["cornice", "moulding", "ceiling", "decor"], specifications: { Pieces: "6", Length: "8 ft each", Material: "PVC", Paintable: "Yes" }, bulkPricing: [{ minQty: 4, pricePerUnit: 1370 }] },
  { title: "Digital Smart Door Lock (Fingerprint + PIN + Key)", brand: "Godrej", description: "5-way unlock smart lock — fingerprint, PIN, RFID card, mobile app and manual key.", price: 12500, mrp: 15990, stock: 80, rating: 4.5, numReviews: 63, gstRate: 18, weight: 3.4, tags: ["smart-lock", "fingerprint", "door", "security"], specifications: { Unlock: "Fingerprint/PIN/RFID/App/Key", Battery: "4x AA", AutoLock: "Yes", Warranty: "2 Years" } },
  { title: "Wall-Mounted Foldable Study Table (Walnut)", brand: "HomeCraft", description: "Space-saving fold-down desk with storage shelf — ideal for compact rooms.", price: 2950, mrp: 4100, stock: 160, rating: 4.3, numReviews: 51, gstRate: 18, weight: 12, tags: ["study-table", "foldable", "wall-mounted", "space-saving"], specifications: { Size: "60x40 cm (open)", Finish: "Walnut", Material: "Engineered Wood", Storage: "Inner Shelf" } },
  { title: "Ceramic Designer Wash Basin with Counter (White)", brand: "Hindware", description: "Tabletop ceramic wash basin with a glossy finish for modern bathrooms.", price: 3850, mrp: 5200, stock: 120, rating: 4.4, numReviews: 44, gstRate: 18, weight: 11, tags: ["wash-basin", "bathroom", "ceramic", "tabletop"], specifications: { Type: "Tabletop", Material: "Ceramic", Colour: "Glossy White", Size: "18 inch" } },
];

function buildSku(catName: string, index: number): string {
  const prefix = catName.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  return `${prefix}-${String(index + 1).padStart(4, "0")}`;
}

async function seed() {
  await connectDB();

  console.log("[seed] clearing existing products & categories…");
  await ProductModel.deleteMany({});
  await CategoryModel.deleteMany({});

  const datasets: [string, SeedProduct[]][] = [
    ["Tiles", TILES],
    ["Paints", PAINTS],
    ["Electrical", ELECTRICAL],
    ["Home Interiors", INTERIORS],
  ];

  let totalProducts = 0;
  for (const meta of CATEGORIES) {
    const category = await CategoryModel.create({
      name: meta.name,
      slug: slugify(meta.name),
      image: meta.image,
      order: meta.order,
    });

    const products = datasets.find(([n]) => n === meta.name)?.[1] ?? [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const slug = slugify(p.title);
      await ProductModel.create({
        ...p,
        slug,
        sku: buildSku(meta.name, i),
        category: category._id,
        images: [img(slug, 1), img(slug, 2), img(slug, 3)],
        isActive: true,
      });
      totalProducts++;
    }
    console.log(`[seed] ${meta.name}: ${products.length} products`);
  }

  console.log(`[seed] done — ${CATEGORIES.length} categories, ${totalProducts} products.`);
  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
