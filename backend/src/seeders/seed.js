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
const BarcodeGenerator = require('../utils/barcodeGenerator');

const seedDatabase = async () => {
  try {
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
      Vendor.deleteMany({})
    ]);

    // 1. Seed Permissions
    console.log('[Seeder] Seeding Permissions...');
    const permissionDocs = [
      { name: PERMISSIONS.VIEW, module: 'ALL', description: 'View data across modules' },
      { name: PERMISSIONS.CREATE, module: 'ALL', description: 'Create records' },
      { name: PERMISSIONS.UPDATE, module: 'ALL', description: 'Modify records' },
      { name: PERMISSIONS.DELETE, module: 'ALL', description: 'Delete records' },
      { name: PERMISSIONS.APPROVE, module: 'ALL', description: 'Approve transactions' },
      { name: PERMISSIONS.CANCEL, module: 'ALL', description: 'Cancel bills and payments' },
      { name: PERMISSIONS.PRINT, module: 'ALL', description: 'Print invoices and receipts' },
      { name: PERMISSIONS.EXPORT, module: 'ALL', description: 'Export Excel reports' }
    ];
    await Permission.insertMany(permissionDocs);

    // 2. Seed Roles
    console.log('[Seeder] Seeding Roles...');
    const allPerms = Object.values(PERMISSIONS);
    const rolesData = [
      { name: ROLES.SUPER_ADMIN, description: 'Super Administrator with full access', permissions: ['*'], isSystemRole: true },
      { name: ROLES.ADMIN, description: 'Store Administrator', permissions: allPerms, isSystemRole: true },
      { name: ROLES.BRANCH_MANAGER, description: 'Branch Store Manager', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.APPROVE, PERMISSIONS.CANCEL, PERMISSIONS.PRINT, PERMISSIONS.EXPORT] },
      { name: ROLES.SALES_MANAGER, description: 'Sales Team Manager', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.APPROVE, PERMISSIONS.PRINT] },
      { name: ROLES.SALES_EXECUTIVE, description: 'Front-desk Sales Staff', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.PRINT] },
      { name: ROLES.PURCHASE_MANAGER, description: 'Purchases and Vendor Manager', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.APPROVE, PERMISSIONS.PRINT] },
      { name: ROLES.INVENTORY_MANAGER, description: 'Stock & Warehouse Manager', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.PRINT, PERMISSIONS.EXPORT] },
      { name: ROLES.ACCOUNTANT, description: 'Accounts and Financial Controller', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.APPROVE, PERMISSIONS.CANCEL, PERMISSIONS.EXPORT] },
      { name: ROLES.CASHIER, description: 'Cash and POS Counter Cashier', permissions: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.PRINT] }
    ];
    const createdRoles = await Role.insertMany(rolesData);
    const superAdminRole = createdRoles.find((r) => r.name === ROLES.SUPER_ADMIN);

    // 3. Seed Demo Branch
    console.log('[Seeder] Seeding Demo Branches...');
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

    // 4. Seed Super Admin User
    console.log('[Seeder] Seeding Admin User...');
    const adminUser = await User.create({
      name: 'Master Admin',
      email: 'admin@jewelleryerp.com',
      phone: '+91 9999999999',
      password: 'Admin@12345',
      roleId: superAdminRole._id,
      role: ROLES.SUPER_ADMIN,
      branchId: headOffice._id,
      isActive: true
    });

    // 5. Seed Product Categories
    console.log('[Seeder] Seeding Product Categories...');
    const categoriesData = [
      { name: 'Gold Bangles', code: 'GBAN', metal: METALS.GOLD, hsnCode: '7113', defaultMakingType: MAKING_CHARGE_TYPES.PER_GRAM, defaultMakingRate: 450, defaultWastagePercent: 3.5 },
      { name: 'Gold Necklaces', code: 'GNEC', metal: METALS.GOLD, hsnCode: '7113', defaultMakingType: MAKING_CHARGE_TYPES.PER_GRAM, defaultMakingRate: 550, defaultWastagePercent: 4.0 },
      { name: 'Gold Rings', code: 'GRIN', metal: METALS.GOLD, hsnCode: '7113', defaultMakingType: MAKING_CHARGE_TYPES.FIXED, defaultMakingRate: 1500, defaultWastagePercent: 2.5 },
      { name: 'Gold Chains', code: 'GCHN', metal: METALS.GOLD, hsnCode: '7113', defaultMakingType: MAKING_CHARGE_TYPES.PER_GRAM, defaultMakingRate: 350, defaultWastagePercent: 2.0 },
      { name: 'Diamond Rings', code: 'DRIN', metal: METALS.DIAMOND, hsnCode: '7113', defaultMakingType: MAKING_CHARGE_TYPES.FIXED, defaultMakingRate: 3500, defaultWastagePercent: 0 },
      { name: 'Silver Articles', code: 'SART', metal: METALS.SILVER, hsnCode: '7114', defaultMakingType: MAKING_CHARGE_TYPES.PER_GRAM, defaultMakingRate: 25, defaultWastagePercent: 5.0 },
      { name: 'Gold Bullion Coins', code: 'GCOI', metal: METALS.GOLD, hsnCode: '7118', defaultMakingType: MAKING_CHARGE_TYPES.FIXED, defaultMakingRate: 200, defaultWastagePercent: 0 }
    ];
    const createdCategories = await Category.insertMany(categoriesData);

    // 6. Seed Master Products
    console.log('[Seeder] Seeding Master Products...');
    const bangleCat = createdCategories.find((c) => c.code === 'GBAN');
    const neckCat = createdCategories.find((c) => c.code === 'GNEC');
    const coinCat = createdCategories.find((c) => c.code === 'GCOI');

    const productsData = [
      {
        name: '22K Traditional Peacock Gold Bangle',
        code: 'PBAN-01',
        sku: 'PBAN-01-22K',
        categoryId: bangleCat._id,
        metal: METALS.GOLD,
        purity: PURITIES.GOLD_22K,
        standardGrossWeight: 25.5,
        standardNetWeight: 25.5,
        makingType: MAKING_CHARGE_TYPES.PER_GRAM,
        makingRate: 450,
        wastagePercent: 3.5
      },
      {
        name: '22K Antique Floral Bridal Necklace Set',
        code: 'FNEC-01',
        sku: 'FNEC-01-22K',
        categoryId: neckCat._id,
        metal: METALS.GOLD,
        purity: PURITIES.GOLD_22K,
        standardGrossWeight: 48.2,
        standardNetWeight: 45.0,
        standardStoneWeight: 3.2,
        makingType: MAKING_CHARGE_TYPES.PER_GRAM,
        makingRate: 600,
        wastagePercent: 4.5
      },
      {
        name: '24K 999 Purity 10-Gram Gold Coin',
        code: 'GCOIN-10G',
        sku: 'GCOIN-10G-24K',
        categoryId: coinCat._id,
        metal: METALS.GOLD,
        purity: PURITIES.GOLD_24K,
        standardGrossWeight: 10.0,
        standardNetWeight: 10.0,
        makingType: MAKING_CHARGE_TYPES.FIXED,
        makingRate: 250,
        wastagePercent: 0
      }
    ];
    const createdProducts = await Product.insertMany(productsData);

    // 7. Seed Active Gold Rates
    console.log('[Seeder] Seeding Current Gold Rates...');
    const ratesData = [
      { metal: METALS.GOLD, purity: PURITIES.GOLD_24K, rate: 7850, branchId: headOffice._id, isCurrent: true, createdBy: adminUser._id },
      { metal: METALS.GOLD, purity: PURITIES.GOLD_22K, rate: 7195, branchId: headOffice._id, isCurrent: true, createdBy: adminUser._id },
      { metal: METALS.GOLD, purity: PURITIES.GOLD_18K, rate: 5885, branchId: headOffice._id, isCurrent: true, createdBy: adminUser._id },
      { metal: METALS.SILVER, purity: PURITIES.SILVER_999, rate: 96, branchId: headOffice._id, isCurrent: true, createdBy: adminUser._id }
    ];
    await GoldRate.insertMany(ratesData);

    // 8. Seed Demo Customer & Vendor
    console.log('[Seeder] Seeding Demo Customer and Vendor...');
    const customer = await Customer.create({
      name: 'Rajesh Sharma',
      mobile: '9876543210',
      email: 'rajesh.sharma@example.com',
      address: {
        street: 'Flat 402, Shanti Heights, Andheri West',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: '27',
        pincode: '400053'
      },
      openingBalance: 0,
      currentBalance: 0,
      branchId: headOffice._id
    });

    const vendor = await Vendor.create({
      name: 'Mukeshbhai Choksi',
      company: 'Surat Bullion & Fine Jewellery Wholesale',
      mobile: '9822114455',
      email: 'sales@suratbullion.com',
      gstin: '24BBBBB1111B1Z9',
      address: {
        street: 'Ring Road Wholesale Market',
        city: 'Surat',
        state: 'Gujarat',
        stateCode: '24',
        pincode: '395002'
      },
      openingBalance: 0,
      currentBalance: 0,
      branchId: headOffice._id
    });

    // 9. Seed Ready Inventory Items with Unique Barcodes
    console.log('[Seeder] Seeding Initial Ready Inventory Items...');
    const inventoryItems = [
      {
        productId: createdProducts[0]._id,
        barcode: 'JWL-2609-BAN001',
        categoryId: bangleCat._id,
        metal: METALS.GOLD,
        purity: PURITIES.GOLD_22K,
        grossWeight: 25.5,
        stoneWeight: 0,
        netWeight: 25.5,
        quantity: 1,
        costPrice: 175000,
        makingType: MAKING_CHARGE_TYPES.PER_GRAM,
        makingRate: 450,
        wastagePercent: 3.5,
        branchId: headOffice._id,
        warehouseLocation: 'Display Counter 1',
        status: INVENTORY_STATUSES.AVAILABLE
      },
      {
        productId: createdProducts[1]._id,
        barcode: 'JWL-2609-NEC002',
        categoryId: neckCat._id,
        metal: METALS.GOLD,
        purity: PURITIES.GOLD_22K,
        grossWeight: 48.2,
        stoneWeight: 3.2,
        netWeight: 45.0,
        quantity: 1,
        costPrice: 320000,
        makingType: MAKING_CHARGE_TYPES.PER_GRAM,
        makingRate: 600,
        wastagePercent: 4.5,
        stoneAmount: 12000,
        branchId: headOffice._id,
        warehouseLocation: 'Bridal Safe 2',
        status: INVENTORY_STATUSES.AVAILABLE
      },
      {
        productId: createdProducts[2]._id,
        barcode: 'JWL-2609-COIN003',
        categoryId: coinCat._id,
        metal: METALS.GOLD,
        purity: PURITIES.GOLD_24K,
        grossWeight: 10.0,
        stoneWeight: 0,
        netWeight: 10.0,
        quantity: 5,
        costPrice: 78000,
        makingType: MAKING_CHARGE_TYPES.FIXED,
        makingRate: 250,
        wastagePercent: 0,
        branchId: headOffice._id,
        warehouseLocation: 'Cashier Safe 1',
        status: INVENTORY_STATUSES.AVAILABLE
      }
    ];
    await Inventory.insertMany(inventoryItems);

    console.log('====================================================');
    console.log('  DATABASE SEEDED SUCCESSFULLY!');
    console.log('  Admin Login:');
    console.log('    Email:    admin@jewelleryerp.com');
    console.log('    Password: Admin@12345');
    console.log('    Branch:   HO01 (Flagship Branch)');
    console.log('====================================================');

    process.exit(0);
  } catch (error) {
    console.error('[Seeder] Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
