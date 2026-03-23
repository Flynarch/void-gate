export const ITEMS = {
  health_potion: {
    id: "health_potion",
    name: "Health Potion",
    char: "!",
    color: "#ff4444",
    desc: "Heals 20 HP",
    rarity: "common",
    onUse: (scene) => {
      const heal = Math.min(20, scene.playerMaxHp - scene.playerHp);
      scene.playerHp += heal;
      scene.spawnDamageNumber(scene.px, scene.py, `+${heal} HP`, "#44ff44");
      scene.refreshHUD();
      return true;
    },
  },
  big_potion: {
    id: "big_potion",
    name: "Big Potion",
    char: "!",
    color: "#ff88ff",
    desc: "Heals 50 HP",
    rarity: "uncommon",
    onUse: (scene) => {
      const heal = Math.min(50, scene.playerMaxHp - scene.playerHp);
      scene.playerHp += heal;
      scene.spawnDamageNumber(scene.px, scene.py, `+${heal} HP`, "#44ff44");
      scene.refreshHUD();
      return true;
    },
  },
  sword: {
    id: "sword",
    name: "Iron Sword",
    char: "/",
    color: "#ccddff",
    desc: "+3 ATK",
    rarity: "common",
    onUse: (scene) => {
      scene.playerAtk += 3;
      scene.spawnDamageNumber(scene.px, scene.py, "+3 ATK", "#ccddff");
      scene.refreshHUD();
      return true;
    },
  },
  shield: {
    id: "shield",
    name: "Buckler",
    char: "]",
    color: "#88aaff",
    desc: "+2 DEF",
    rarity: "common",
    onUse: (scene) => {
      scene.playerDef += 2;
      scene.spawnDamageNumber(scene.px, scene.py, "+2 DEF", "#88aaff");
      scene.refreshHUD();
      return true;
    },
  },
  gold_coin: {
    id: "gold_coin",
    name: "Gold",
    char: "$",
    color: "#f0c040",
    desc: "+10 Gold",
    rarity: "common",
    onUse: (scene) => {
      scene.playerGold += 10;
      scene.spawnDamageNumber(scene.px, scene.py, "+10 Gold", "#f0c040");
      scene.refreshHUD();
      return true;
    },
  },
  max_up: {
    id: "max_up",
    name: "Life Crystal",
    char: "♥",
    color: "#ff4488",
    desc: "+10 Max HP",
    rarity: "rare",
    onUse: (scene) => {
      scene.playerMaxHp += 10;
      scene.playerHp = Math.min(scene.playerHp + 10, scene.playerMaxHp);
      scene.spawnDamageNumber(scene.px, scene.py, "+10 MAX HP", "#ff4488");
      scene.refreshHUD();
      return true;
    },
  },
};

export const FLOOR_LOOT_TABLE = [
  { id: "health_potion", weight: 40 },
  { id: "big_potion", weight: 15 },
  { id: "sword", weight: 20 },
  { id: "shield", weight: 20 },
  { id: "gold_coin", weight: 50 },
  { id: "max_up", weight: 8 },
];

export function rollLoot() {
  const total = FLOOR_LOOT_TABLE.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const entry of FLOOR_LOOT_TABLE) {
    r -= entry.weight;
    if (r <= 0) return { ...ITEMS[entry.id] };
  }
  return { ...ITEMS["health_potion"] };
}
