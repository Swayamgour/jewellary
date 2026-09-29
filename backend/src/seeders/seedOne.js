const mongoose = require('mongoose');
const env = require('../config/env');
const { ROLES, PERMISSIONS, METALS, PURITIES, MAKING_CHARGE_TYPES, INVENTORY_STATUSES } = require('../config/constants');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const Branch = require('../models/Branch');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const GoldRate = require('../models/GoldRate');
const Inventory = require('../models/Inventory');
const Customer = require('../models/Customer');
const Vendor = require('../models/Vendor');
const Counter = require('../models/Counter');

const dns = require("dns");

dns.setServers([
    "1.1.1.1",
    "8.8.8.8"
]);

// Today's base rates (per gram)
const TODAY_RATES = {
    [PURITIES.GOLD_24K]: 7850,
    [PURITIES.GOLD_22K]: 7195,
    [PURITIES.GOLD_18K]: 5885,
    [PURITIES.SILVER_999]: 96
};

const seedDatabase = async () => {
    try {
        if (env.IS_PROD && !process.argv.includes('--force')) {
            console.error('[Seeder] Refusing to WIPE a production database. Re-run with --force if you really mean it.');
            process.exit(1);
        }
        console.log('[Seeder] Connecting to MongoDB...');
        await mongoose.connect(env.MONGO_URI);
        console.log('[Seeder] Connected.');

        console.log('[Seeder] Clearing previous collections...');
        await Promise.all([
            Role.deleteMany({}),
            Permission.deleteMany({}),
            Branch.deleteMany({}),
            User.deleteMany({}),
            Category.deleteMany({}),
            Product.deleteMany({}),
            GoldRate.deleteMany({}),
            Inventory.deleteMany({}),
            Customer.deleteMany({}),
            Vendor.deleteMany({}),
            Counter.deleteMany({})
        ]);

        // 1. Permissions
        console.log('[Seeder] Seeding Permissions...');
        await Permission.insertMany([
            { name: PERMISSIONS.VIEW, module: 'ALL', description: 'View data across modules' },
            { name: PERMISSIONS.CREATE, module: 'ALL', description: 'Create records' },
            { name: PERMISSIONS.UPDATE, module: 'ALL', description: 'Modify records' },
            { name: PERMISSIONS.DELETE, module: 'ALL', description: 'Delete records' },
            { name: PERMISSIONS.APPROVE, module: 'ALL', description: 'Approve transactions' },
            { name: PERMISSIONS.CANCEL, module: 'ALL', description: 'Cancel bills and payments' },
            { name: PERMISSIONS.PRINT, module: 'ALL', description: 'Print invoices and receipts' },
            { name: PERMISSIONS.EXPORT, module: 'ALL', description: 'Export Excel reports' }
        ]);

        // 2. Roles
        console.log('[Seeder] Seeding Roles...');
        const allPerms = Object.values(PERMISSIONS);
        const createdRoles = await Role.insertMany([
            { name: ROLES.SUPER_ADMIN, description: 'Super Administrator with full access', permissions: ['*'], isSystemRole: true },
            { name: ROLES.ADMIN, description: 'Store Administrator', permissions: allPerms, isSystemRole: true },
            { name: ROLES.BRANCH_MANAGER, description: 'Branch Store Manager', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.APPROVE, PERMISSIONS.CANCEL, PERMISSIONS.PRINT, PERMISSIONS.EXPORT] },
            { name: ROLES.SALES_MANAGER, description: 'Sales Team Manager', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.APPROVE, PERMISSIONS.PRINT] },
            { name: ROLES.SALES_EXECUTIVE, description: 'Front-desk Sales Staff', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.PRINT] },
            { name: ROLES.PURCHASE_MANAGER, description: 'Purchases and Vendor Manager', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.APPROVE, PERMISSIONS.PRINT] },
            { name: ROLES.INVENTORY_MANAGER, description: 'Stock & Warehouse Manager', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.PRINT, PERMISSIONS.EXPORT] },
            { name: ROLES.ACCOUNTANT, description: 'Accounts and Financial Controller', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.APPROVE, PERMISSIONS.CANCEL, PERMISSIONS.EXPORT] },
            { name: ROLES.CASHIER, description: 'Cash and POS Counter Cashier', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.PRINT] }
        ]);
        const roleByName = (name) => createdRoles.find((r) => r.name === name);

        // 3. Branch (single)
        console.log('[Seeder] Seeding Branch...');
        const headOffice = await Branch.create({
            name: 'Jewellery Emporium - Flagship Branch',
            code: 'HO01',
            address: {
                street: '101, Zaveri Bazaar, Kalbadevi',
                city: 'Mumbai',
                state: 'Maharashtra',
                stateCode: '27',
                pincode: '400002'
            },
            phone: '+91 22 2244 5566',
            email: 'ho@jewelleryemporium.com',
            gstin: '27AAAAA0000A1Z5',
            isHeadOffice: true,
            isActive: true
        });

        // 4. Users - one per role (User.create so password hashing hooks run)
        console.log('[Seeder] Seeding Users for every role...');
        const usersData = [
            { name: 'Master Admin', email: 'admin@jewelleryerp.com', role: ROLES.SUPER_ADMIN, password: 'Admin@12345' },
            { name: 'Store Admin - Kavita Joshi', email: 'storeadmin@jewelleryerp.com', role: ROLES.ADMIN },
            { name: 'Branch Manager - Sanjay Mehta', email: 'manager@jewelleryerp.com', role: ROLES.BRANCH_MANAGER },
            { name: 'Sales Manager - Priya Nair', email: 'salesmanager@jewelleryerp.com', role: ROLES.SALES_MANAGER },
            { name: 'Sales Executive - Amit Patil', email: 'sales@jewelleryerp.com', role: ROLES.SALES_EXECUTIVE },
            { name: 'Purchase Manager - Vikram Shah', email: 'purchase@jewelleryerp.com', role: ROLES.PURCHASE_MANAGER },
            { name: 'Inventory Manager - Neha Kulkarni', email: 'inventory@jewelleryerp.com', role: ROLES.INVENTORY_MANAGER },
            { name: 'Accountant - Rohit Agarwal', email: 'accounts@jewelleryerp.com', role: ROLES.ACCOUNTANT },
            { name: 'Cashier - Sunita Yadav', email: 'cashier@jewelleryerp.com', role: ROLES.CASHIER }
        ];
        let adminUser = null;
        for (let i = 0; i < usersData.length; i++) {
            const u = usersData[i];
            const created = await User.create({
                name: u.name,
                email: u.email,
                phone: `+91 98000000${String(10 + i).padStart(2, '0')}`,
                password: u.password || 'Staff@12345',
                roleId: roleByName(u.role)._id,
                role: u.role,
                branchId: headOffice._id,
                isActive: true
            });
            if (i === 0) adminUser = created;
        }

        // 5. Categories (12)
        console.log('[Seeder] Seeding Product Categories...');
        const PG = MAKING_CHARGE_TYPES.PER_GRAM;
        const FX = MAKING_CHARGE_TYPES.FIXED;
        const createdCategories = await Category.insertMany([
            { name: 'Gold Bangles', code: 'GBAN', metal: METALS.GOLD, hsnCode: '7113', defaultMakingType: PG, defaultMakingRate: 450, defaultWastagePercent: 3.5 },
            { name: 'Gold Necklaces', code: 'GNEC', metal: METALS.GOLD, hsnCode: '7113', defaultMakingType: PG, defaultMakingRate: 550, defaultWastagePercent: 4.0 },
            { name: 'Gold Rings', code: 'GRIN', metal: METALS.GOLD, hsnCode: '7113', defaultMakingType: FX, defaultMakingRate: 1500, defaultWastagePercent: 2.5 },
            { name: 'Gold Chains', code: 'GCHN', metal: METALS.GOLD, hsnCode: '7113', defaultMakingType: PG, defaultMakingRate: 350, defaultWastagePercent: 2.0 },
            { name: 'Diamond Rings', code: 'DRIN', metal: METALS.DIAMOND, hsnCode: '7113', defaultMakingType: FX, defaultMakingRate: 3500, defaultWastagePercent: 0 },
            { name: 'Silver Articles', code: 'SART', metal: METALS.SILVER, hsnCode: '7114', defaultMakingType: PG, defaultMakingRate: 25, defaultWastagePercent: 5.0 },
            { name: 'Gold Bullion Coins', code: 'GCOI', metal: METALS.GOLD, hsnCode: '7118', defaultMakingType: FX, defaultMakingRate: 200, defaultWastagePercent: 0 },
            { name: 'Gold Earrings', code: 'GEAR', metal: METALS.GOLD, hsnCode: '7113', defaultMakingType: PG, defaultMakingRate: 500, defaultWastagePercent: 3.0 },
            { name: 'Gold Pendants', code: 'GPEN', metal: METALS.GOLD, hsnCode: '7113', defaultMakingType: PG, defaultMakingRate: 480, defaultWastagePercent: 3.0 },
            { name: 'Gold Mangalsutra', code: 'GMAN', metal: METALS.GOLD, hsnCode: '7113', defaultMakingType: PG, defaultMakingRate: 520, defaultWastagePercent: 4.0 },
            { name: 'Silver Anklets', code: 'SANK', metal: METALS.SILVER, hsnCode: '7114', defaultMakingType: PG, defaultMakingRate: 30, defaultWastagePercent: 5.0 },
            { name: 'Diamond Earrings', code: 'DEAR', metal: METALS.DIAMOND, hsnCode: '7113', defaultMakingType: FX, defaultMakingRate: 3000, defaultWastagePercent: 0 }
        ]);
        const catId = (code) => createdCategories.find((c) => c.code === code)._id;

        // 6. Products (20)
        console.log('[Seeder] Seeding Master Products...');
        const G = METALS.GOLD;
        const S = METALS.SILVER;
        const D = METALS.DIAMOND;
        const P22 = PURITIES.GOLD_22K;
        const P24 = PURITIES.GOLD_24K;
        const P18 = PURITIES.GOLD_18K;
        const PS = PURITIES.SILVER_999;

        // [name, code, category, metal, purity, gross, stone, net, makingType, makingRate, wastage, stoneAmountPerPiece]
        const productSpecs = [
            ['22K Traditional Peacock Gold Bangle', 'PBAN-01', 'GBAN', G, P22, 25.5, 0, 25.5, PG, 450, 3.5, 0],
            ['22K Plain Gold Kada', 'KADA-01', 'GBAN', G, P22, 30.0, 0, 30.0, PG, 420, 3.0, 0],
            ['22K Antique Floral Bridal Necklace Set', 'FNEC-01', 'GNEC', G, P22, 48.2, 3.2, 45.0, PG, 600, 4.5, 12000],
            ['22K Temple Haram Long Necklace', 'THAR-01', 'GNEC', G, P22, 60.0, 0, 60.0, PG, 580, 4.0, 0],
            ['22K Light Weight Choker', 'CHOK-01', 'GNEC', G, P22, 22.4, 0.4, 22.0, PG, 560, 4.0, 2500],
            ['22K Gents Signet Gold Ring', 'GRNG-01', 'GRIN', G, P22, 8.0, 0, 8.0, FX, 1500, 2.5, 0],
            ['22K Ladies Floral Gold Ring', 'LRNG-01', 'GRIN', G, P22, 4.2, 0.2, 4.0, FX, 1200, 2.5, 800],
            ['22K Rope Gold Chain 22 inch', 'RCHN-01', 'GCHN', G, P22, 20.0, 0, 20.0, PG, 350, 2.0, 0],
            ['22K Box Gold Chain 20 inch', 'BCHN-01', 'GCHN', G, P22, 15.0, 0, 15.0, PG, 340, 2.0, 0],
            ['18K Diamond Engagement Ring', 'DRNG-01', 'DRIN', D, P18, 5.0, 0.5, 4.5, FX, 3500, 0, 45000],
            ['24K 999 Purity 10-Gram Gold Coin', 'GCOIN-10G', 'GCOI', G, P24, 10.0, 0, 10.0, FX, 250, 0, 0],
            ['24K 999 Purity 5-Gram Gold Coin', 'GCOIN-05G', 'GCOI', G, P24, 5.0, 0, 5.0, FX, 180, 0, 0],
            ['24K 999 Purity 20-Gram Gold Coin', 'GCOIN-20G', 'GCOI', G, P24, 20.0, 0, 20.0, FX, 400, 0, 0],
            ['999 Silver Pooja Thali Set', 'SPTH-01', 'SART', S, PS, 250.0, 0, 250.0, PG, 25, 5.0, 0],
            ['22K Gold Jhumka Earrings', 'JHUM-01', 'GEAR', G, P22, 12.0, 0.6, 11.4, PG, 520, 3.0, 3000],
            ['22K Gold Stud Earrings', 'STUD-01', 'GEAR', G, P22, 3.0, 0, 3.0, PG, 500, 3.0, 0],
            ['22K Gold Om Pendant', 'OPEN-01', 'GPEN', G, P22, 6.0, 0, 6.0, PG, 480, 3.0, 0],
            ['22K Gold Mangalsutra with Black Beads', 'MANG-01', 'GMAN', G, P22, 18.5, 0.5, 18.0, PG, 520, 4.0, 600],
            ['999 Silver Payal Anklet Pair', 'SANK-01', 'SANK', S, PS, 80.0, 0, 80.0, PG, 30, 5.0, 0],
            ['18K Diamond Stud Earrings', 'DEAR-01', 'DEAR', D, P18, 4.0, 0.4, 3.6, FX, 3000, 0, 38000]
        ];

        const createdProducts = await Product.insertMany(
            productSpecs.map(([name, code, cat, metal, purity, gross, stone, net, mType, mRate, wastage]) => {
                const doc = {
                    name,
                    code,
                    sku: `${code}-${purity}`,
                    categoryId: catId(cat),
                    metal,
                    purity,
                    standardGrossWeight: gross,
                    standardNetWeight: net,
                    makingType: mType,
                    makingRate: mRate,
                    wastagePercent: wastage
                };
                if (stone > 0) doc.standardStoneWeight = stone;
                return doc;
            })
        );

        // 7. Gold rates - current + 9 days of history
        console.log('[Seeder] Seeding Gold Rate history...');
        const DAY = 24 * 60 * 60 * 1000;
        // Offsets (Rs/gram on 24K) for today, 1 day ago, 2 days ago ...
        const offsets24 = [0, -40, 25, 60, -15, -55, 30, 10, -20, 45];
        const silverOffsets = [0, -1, 1, 2, 0, -2, 1, 0, -1, 1];
        const ratesData = [];
        offsets24.forEach((off, daysAgo) => {
            const base24 = TODAY_RATES[P24] + off;
            const isCurrent = daysAgo === 0;
            const when = new Date(Date.now() - daysAgo * DAY);
            const rows = [
                { metal: G, purity: P24, rate: base24 },
                { metal: G, purity: P22, rate: isCurrent ? TODAY_RATES[P22] : Math.round(base24 * 0.9165) },
                { metal: G, purity: P18, rate: isCurrent ? TODAY_RATES[P18] : Math.round(base24 * 0.7497) },
                { metal: S, purity: PS, rate: TODAY_RATES[PS] + silverOffsets[daysAgo] }
            ];
            rows.forEach((r) =>
                ratesData.push({
                    ...r,
                    branchId: headOffice._id,
                    isCurrent,
                    createdBy: adminUser._id,
                    createdAt: when,
                    updatedAt: when
                })
            );
        });
        await GoldRate.insertMany(ratesData);

        // 8. Customers (15)
        console.log('[Seeder] Seeding Customers...');
        const customerSpecs = [
            ['Rajesh Sharma', 'Andheri West', 'Mumbai', 'Maharashtra', '27', '400053'],
            ['Sunita Verma', 'Borivali East', 'Mumbai', 'Maharashtra', '27', '400066'],
            ['Anil Kapoor', 'Bandra West', 'Mumbai', 'Maharashtra', '27', '400050'],
            ['Meera Iyer', 'Matunga', 'Mumbai', 'Maharashtra', '27', '400019'],
            ['Deepak Gupta', 'Thane West', 'Thane', 'Maharashtra', '27', '400601'],
            ['Pooja Deshmukh', 'Kothrud', 'Pune', 'Maharashtra', '27', '411038'],
            ['Harish Patel', 'Navrangpura', 'Ahmedabad', 'Gujarat', '24', '380009'],
            ['Kiran Reddy', 'Banjara Hills', 'Hyderabad', 'Telangana', '36', '500034'],
            ['Farhan Qureshi', 'Mohammed Ali Road', 'Mumbai', 'Maharashtra', '27', '400003'],
            ['Lata Kulkarni', 'Dadar West', 'Mumbai', 'Maharashtra', '27', '400028'],
            ['Sandeep Singh', 'Vashi', 'Navi Mumbai', 'Maharashtra', '27', '400703'],
            ['Rekha Jain', 'Ghatkopar East', 'Mumbai', 'Maharashtra', '27', '400077'],
            ['Manoj Tiwari', 'Malad West', 'Mumbai', 'Maharashtra', '27', '400064'],
            ['Ananya Bose', 'Salt Lake', 'Kolkata', 'West Bengal', '19', '700091'],
            ['Vijay Menon', 'Vile Parle East', 'Mumbai', 'Maharashtra', '27', '400057']
        ];
        for (let i = 0; i < customerSpecs.length; i++) {
            const [name, area, city, state, stateCode, pincode] = customerSpecs[i];
            const first = name.split(' ')[0].toLowerCase();
            await Customer.create({
                name,
                mobile: `98765432${String(10 + i).padStart(2, '0')}`,
                email: `${first}.${name.split(' ')[1].toLowerCase()}@example.com`,
                address: { street: `${101 + i * 7}, ${area}`, city, state, stateCode, pincode },
                openingBalance: 0,
                currentBalance: 0,
                branchId: headOffice._id
            });
        }

        // 9. Vendors (6)
        console.log('[Seeder] Seeding Vendors...');
        const vendorSpecs = [
            ['Mukeshbhai Choksi', 'Surat Bullion & Fine Jewellery Wholesale', 'Surat', 'Gujarat', '24', '395002', 'Ring Road Wholesale Market', '24BBBBB1111B1Z9'],
            ['Ramesh Soni', 'Soni Gold Refinery', 'Jaipur', 'Rajasthan', '08', '302003', 'Johari Bazaar', '08CCCCC2222C1Z3'],
            ['Ashok Bhansali', 'Bhansali Diamonds Pvt Ltd', 'Mumbai', 'Maharashtra', '27', '400004', 'Opera House, Girgaon', '27DDDDD3333D1Z7'],
            ['Sundar Raman', 'Raman Temple Jewellers', 'Chennai', 'Tamil Nadu', '33', '600017', 'T Nagar Main Road', '33EEEEE4444E1Z1'],
            ['Gopal Das', 'Bengal Gold Craft', 'Kolkata', 'West Bengal', '19', '700007', 'Bowbazar Street', '19FFFFF5555F1Z5'],
            ['Jignesh Modi', 'Modi Silver Works', 'Rajkot', 'Gujarat', '24', '360001', 'Soni Bazaar', '24GGGGG6666G1Z8']
        ];
        for (let i = 0; i < vendorSpecs.length; i++) {
            const [name, company, city, state, stateCode, pincode, street, gstin] = vendorSpecs[i];
            await Vendor.create({
                name,
                company,
                mobile: `98221144${String(55 + i).padStart(2, '0')}`,
                email: `sales${i + 1}@${company.split(' ')[0].toLowerCase()}.com`,
                gstin,
                address: { street, city, state, stateCode, pincode },
                openingBalance: 0,
                currentBalance: 0,
                branchId: headOffice._id
            });
        }

        // 10. Inventory (3-4 pieces per product => 70 items) with unique barcodes
        console.log('[Seeder] Seeding Inventory Items...');
        const locations = ['Display Counter 1', 'Display Counter 2', 'Display Counter 3', 'Bridal Safe 2', 'Cashier Safe 1', 'Vault A', 'Vault B'];
        const weightFactors = [1.0, 0.95, 1.04, 1.08];
        const inventoryItems = [];
        let seq = 1;

        productSpecs.forEach((spec, idx) => {
            const [, code, cat, metal, purity, gross, stone, net, mType, mRate, wastage, stoneAmt] = spec;
            const product = createdProducts[idx];
            const copies = idx % 2 === 0 ? 4 : 3;
            const isCoin = cat === 'GCOI';

            for (let c = 0; c < copies; c++) {
                // Coins & fixed-weight items keep exact weight; others vary slightly
                const factor = isCoin ? 1 : weightFactors[c];
                const netW = Math.round(net * factor * 100) / 100;
                const stoneW = stone;
                const grossW = Math.round((netW + stoneW) * 100) / 100;
                const ratePerGram = TODAY_RATES[purity];
                const metalCost = netW * ratePerGram * (1 + wastage / 100);
                const makingCost = mType === PG ? netW * mRate : mRate;
                const costPrice = Math.round(metalCost + makingCost + stoneAmt);

                const item = {
                    productId: product._id,
                    barcode: `JWL-2609-${code.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase()}${String(seq).padStart(3, '0')}`,
                    categoryId: catId(cat),
                    metal,
                    purity,
                    grossWeight: grossW,
                    stoneWeight: stoneW,
                    netWeight: netW,
                    quantity: isCoin ? 5 : 1,
                    costPrice,
                    makingType: mType,
                    makingRate: mRate,
                    wastagePercent: wastage,
                    branchId: headOffice._id,
                    warehouseLocation: locations[(idx + c) % locations.length],
                    status: INVENTORY_STATUSES.AVAILABLE
                };
                if (stoneAmt > 0) item.stoneAmount = stoneAmt;
                inventoryItems.push(item);
                seq++;
            }
        });
        await Inventory.insertMany(inventoryItems);

        console.log('====================================================');
        console.log('  DATABASE SEEDED SUCCESSFULLY!');
        console.log(`  Branches: 1 | Roles: ${createdRoles.length} | Users: ${usersData.length}`);
        console.log(`  Categories: ${createdCategories.length} | Products: ${createdProducts.length}`);
        console.log(`  Inventory items: ${inventoryItems.length} | Customers: ${customerSpecs.length} | Vendors: ${vendorSpecs.length}`);
        console.log(`  Gold rate rows: ${ratesData.length} (10 days history)`);
        console.log('  ---------------------------------------------------');
        console.log('  Super Admin:  admin@jewelleryerp.com / Admin@12345');
        console.log('  Other users:  <role>@jewelleryerp.com / Staff@12345');
        console.log('    storeadmin, manager, salesmanager, sales,');
        console.log('    purchase, inventory, accounts, cashier');
        console.log('  Branch: HO01 (Flagship Branch)');
        console.log('====================================================');

        process.exit(0);
    } catch (error) {
        console.error('[Seeder] Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();