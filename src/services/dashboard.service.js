const Planning = require('../models/planning.model');
const PlanningItem = require('../models/planningItems.model');
const Menu = require('../models/menu.model');
const Inventory = require('../models/inventory.model');

// Menu: { name, sellingPrice, hargaPokok, laba, ingredients: [{ inventoryId, quantityNeeded, hargaPokokPerBahan }] }
// hargaPokok & laba di dokumen Menu bisa null -> selalu dihitung ulang di sini, tidak pernah dipakai langsung.
// Inventory: { ingredientName, unit, quantity, unitCost }

const hitungHargaPokok = (menu, inventoryMap) => {
    let hargaPokok = 0;
    for (const bahan of menu.ingredients ?? []) {
        const inv = inventoryMap[bahan.inventoryId.toString()];
        const unitCost = inv?.unitCost ?? 0;
        hargaPokok += bahan.quantityNeeded * unitCost;
    }
    return hargaPokok;
};

/**
 * Hitung maksimal porsi yang bisa dibuat untuk setiap menu,
 * dibatasi oleh bahan yang paling sedikit tersedia (bottleneck).
 * Dihitung dari SELURUH stok inventory (bukan hanya sisa di planning aktif),
 * karena kapasitas menu itu independen dari planning mana yang sedang aktif.
 */
const getKapasitasMenu = async (inventoryMap) => {
    const menus = await Menu.find();

    return menus.map((menu) => {
        const ingredients = menu.ingredients ?? [];

        let maksimalBisaDibuat = Infinity;
        for (const bahan of ingredients) {
            const stokTersedia = inventoryMap[bahan.inventoryId.toString()]?.quantity ?? 0;
            const bisaDariBahanIni = Math.floor(stokTersedia / bahan.quantityNeeded);
            maksimalBisaDibuat = Math.min(maksimalBisaDibuat, bisaDariBahanIni);
        }

        // Menu tanpa ingredients dianggap tidak bisa dihitung kapasitasnya -> 0
        if (!isFinite(maksimalBisaDibuat)) {
            maksimalBisaDibuat = 0;
        }

        return {
            menuId: menu._id,
            nama: menu.name,
            maksimalBisaDibuat,
        };
    });
};

const getDashboardSummary = async (userId) => {
    const inventories = await Inventory.find({ userId });
    const inventoryMap = {}; // inventoryId (string) -> dokumen Inventory
    inventories.forEach((inv) => {
        inventoryMap[inv._id.toString()] = inv;
    });

    // "Planning aktif" = planning berstatus final milik user, terbaru
    const planningAktif = await Planning.findOne({
        userId,
        status: 'final',
    }).sort({ updatedAt: -1 });

    const kapasitasMenu = await getKapasitasMenu(inventoryMap);

    if (!planningAktif) {
        return {
            totalLaba: 0,
            kapasitasMenu,
            sisaInventory: [],
            planningAktif: null,
        };
    }

    const items = await PlanningItem.find({
        planningId: planningAktif._id,
    }).populate('menuId');

    let totalLaba = 0;
    const terpakaiMap = {}; // inventoryId (string) -> total dipakai planning aktif

    for (const item of items) {
        const menu = item.menuId;
        if (!menu) continue;

        const hargaPokok = hitungHargaPokok(menu, inventoryMap);
        const labaPerPorsi = (menu.sellingPrice ?? 0) - hargaPokok;
        totalLaba += labaPerPorsi * item.quantity;

        for (const bahan of menu.ingredients ?? []) {
            const key = bahan.inventoryId.toString();
            const jumlahDipakai = bahan.quantityNeeded * item.quantity;
            terpakaiMap[key] = (terpakaiMap[key] ?? 0) + jumlahDipakai;
        }
    }

    const sisaInventory = inventories.map((inv) => {
        const tersedia = inv.quantity ?? 0;
        const terpakaiDiPlanning = terpakaiMap[inv._id.toString()] ?? 0;

        return {
            inventoryId: inv._id,
            namaBahan: inv.ingredientName,
            satuan: inv.unit,
            tersedia,
            terpakaiDiPlanning,
            sisa: tersedia - terpakaiDiPlanning,
        };
    });

    return {
        totalLaba,
        kapasitasMenu,
        sisaInventory,
        planningAktif: {
            id: planningAktif._id,
            namaPlanning: planningAktif.name,
        },
    };
};

module.exports = {
    getDashboardSummary,
};