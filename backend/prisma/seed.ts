import bcrypt from "bcryptjs";
import { PrismaClient, SubscriptionPlan } from "@prisma/client";

const prisma = new PrismaClient();

const run = async () => {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "smart-bistro" },
    update: {
      name: "Smart Bistro",
      currency: "INR",
      timezone: "Asia/Kolkata",
      countryCode: "IN",
      contactPhone: "+919999999999",
      whatsappNumber: "+919999999999",
      onboardingCompleted: true,
      onboardingStep: 5,
      heroImageUrl:
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80",
      logoUrl:
        "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80",
    },
    create: {
      name: "Smart Bistro",
      slug: "smart-bistro",
      currency: "INR",
      timezone: "Asia/Kolkata",
      countryCode: "IN",
      contactPhone: "+919999999999",
      whatsappNumber: "+919999999999",
      onboardingCompleted: true,
      onboardingStep: 5,
      heroImageUrl:
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80",
      logoUrl:
        "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80",
    },
  });

  const adminPassword = await bcrypt.hash("admin1234", 12);
  await prisma.restaurantAdmin.upsert({
    where: {
      restaurantId_email: {
        restaurantId: restaurant.id,
        email: "owner@smarttable.ai",
      },
    },
    update: {
      fullName: "Aarav Kapoor",
      passwordHash: adminPassword,
      role: "OWNER",
    },
    create: {
      restaurantId: restaurant.id,
      fullName: "Aarav Kapoor",
      email: "owner@smarttable.ai",
      passwordHash: adminPassword,
      role: "OWNER",
    },
  });

  await prisma.restaurantSubscription.upsert({
    where: { id: `${restaurant.id}-sub` },
    update: {
      planCode: SubscriptionPlan.GROWTH,
      status: "ACTIVE",
      billingCycle: "MONTHLY",
    },
    create: {
      id: `${restaurant.id}-sub`,
      restaurantId: restaurant.id,
      planCode: SubscriptionPlan.GROWTH,
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      currentPeriodEnds: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const categories = await Promise.all([
    prisma.menuCategory.upsert({
      where: { restaurantId_name: { restaurantId: restaurant.id, name: "Starters" } },
      update: { sortOrder: 1 },
      create: { restaurantId: restaurant.id, name: "Starters", sortOrder: 1, description: "Shareable openers" },
    }),
    prisma.menuCategory.upsert({
      where: { restaurantId_name: { restaurantId: restaurant.id, name: "Main Course" } },
      update: { sortOrder: 2 },
      create: { restaurantId: restaurant.id, name: "Main Course", sortOrder: 2, description: "Signature plates" },
    }),
    prisma.menuCategory.upsert({
      where: { restaurantId_name: { restaurantId: restaurant.id, name: "Drinks" } },
      update: { sortOrder: 3 },
      create: { restaurantId: restaurant.id, name: "Drinks", sortOrder: 3, description: "Craft drinks and coolers" },
    }),
    prisma.menuCategory.upsert({
      where: { restaurantId_name: { restaurantId: restaurant.id, name: "Desserts" } },
      update: { sortOrder: 4 },
      create: { restaurantId: restaurant.id, name: "Desserts", sortOrder: 4, description: "Finish strong" },
    }),
  ]);

  const categoryByName = new Map(categories.map((category) => [category.name, category.id]));

  const menuItems = [
    {
      name: "Burrata Chaat",
      description: "Creamy burrata with tangy tamarind pearls and microgreens.",
      priceCents: 42000,
      categoryName: "Starters",
      prepTimeMins: 8,
      ingredients: ["burrata", "tamarind", "sev", "mint"],
      dietaryTags: ["vegetarian", "shareable", "trending"],
      imageUrl:
        "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
      featuredScore: 96,
    },
    {
      name: "Truffle Fries",
      description: "Crisp fries with truffle oil, parmesan, and aioli.",
      priceCents: 28000,
      categoryName: "Starters",
      prepTimeMins: 10,
      ingredients: ["potato", "truffle oil", "parmesan"],
      dietaryTags: ["vegetarian", "shareable"],
      imageUrl:
        "https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=900&q=80",
      featuredScore: 88,
    },
    {
      name: "Smoked Butter Chicken",
      description: "Slow-cooked chicken, charcoal smoke finish, roomali shards.",
      priceCents: 59000,
      categoryName: "Main Course",
      prepTimeMins: 20,
      ingredients: ["chicken", "tomato", "butter", "cream"],
      dietaryTags: ["signature", "popular"],
      imageUrl:
        "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=80",
      featuredScore: 99,
    },
    {
      name: "Wild Mushroom Risotto",
      description: "Arborio rice, parmesan, mushroom jus, and herb oil.",
      priceCents: 54000,
      categoryName: "Main Course",
      prepTimeMins: 18,
      ingredients: ["arborio rice", "mushroom", "parmesan"],
      dietaryTags: ["vegetarian", "chef-special"],
      imageUrl:
        "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80",
      featuredScore: 92,
    },
    {
      name: "Citrus Cola",
      description: "House cola with orange peel and citrus foam.",
      priceCents: 14000,
      categoryName: "Drinks",
      prepTimeMins: 4,
      ingredients: ["cola", "orange", "citrus foam"],
      dietaryTags: ["beverage", "upsell"],
      imageUrl:
        "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80",
      featuredScore: 84,
    },
    {
      name: "Garlic Bread Flight",
      description: "Three-flavor garlic bread sampler for sharing.",
      priceCents: 22000,
      categoryName: "Starters",
      prepTimeMins: 7,
      ingredients: ["bread", "garlic", "butter"],
      dietaryTags: ["vegetarian", "upsell", "shareable"],
      imageUrl:
        "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80",
      featuredScore: 82,
    },
    {
      name: "Saffron Tres Leches",
      description: "Milk cake with saffron cream and pistachio dust.",
      priceCents: 26000,
      categoryName: "Desserts",
      prepTimeMins: 6,
      ingredients: ["milk cake", "saffron", "pistachio"],
      dietaryTags: ["dessert", "vegetarian"],
      imageUrl:
        "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80",
      featuredScore: 90,
    },
  ];

  const itemIds = new Map<string, string>();
  for (const item of menuItems) {
    const created = await prisma.menuItem.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: item.name,
        },
      },
      update: {
        categoryId: categoryByName.get(item.categoryName)!,
        description: item.description,
        priceCents: item.priceCents,
        imageUrl: item.imageUrl,
        prepTimeMins: item.prepTimeMins,
        ingredients: item.ingredients,
        dietaryTags: item.dietaryTags,
        featuredScore: item.featuredScore,
        isAvailable: true,
      },
      create: {
        restaurantId: restaurant.id,
        categoryId: categoryByName.get(item.categoryName)!,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        imageUrl: item.imageUrl,
        prepTimeMins: item.prepTimeMins,
        ingredients: item.ingredients,
        dietaryTags: item.dietaryTags,
        featuredScore: item.featuredScore,
        isAvailable: true,
      },
    });
    itemIds.set(item.name, created.id);
  }

  await prisma.menuItem.update({
    where: {
      restaurantId_name: {
        restaurantId: restaurant.id,
        name: "Smoked Butter Chicken",
      },
    },
    data: {
      upsellTargets: [itemIds.get("Citrus Cola")!, itemIds.get("Garlic Bread Flight")!],
    },
  });

  await prisma.menuItem.update({
    where: {
      restaurantId_name: {
        restaurantId: restaurant.id,
        name: "Wild Mushroom Risotto",
      },
    },
    data: {
      upsellTargets: [itemIds.get("Citrus Cola")!, itemIds.get("Saffron Tres Leches")!],
    },
  });

  for (let tableNumber = 1; tableNumber <= 12; tableNumber += 1) {
    await prisma.table.upsert({
      where: {
        restaurantId_tableNumber: {
          restaurantId: restaurant.id,
          tableNumber,
        },
      },
      update: {
        label: `Table ${tableNumber}`,
        zone: tableNumber <= 6 ? "Indoor" : "Patio",
        seats: tableNumber % 2 === 0 ? 4 : 2,
      },
      create: {
        restaurantId: restaurant.id,
        tableNumber,
        label: `Table ${tableNumber}`,
        zone: tableNumber <= 6 ? "Indoor" : "Patio",
        seats: tableNumber % 2 === 0 ? 4 : 2,
        qrToken: `smart-bistro-table-${tableNumber}`,
        nfcToken: `smart-bistro-nfc-${tableNumber}`,
      },
    });
  }

  await prisma.promotion.upsert({
    where: {
      restaurantId_code: {
        restaurantId: restaurant.id,
        code: "HAPPY15",
      },
    },
    update: {
      name: "Happy Hour 15%",
      discountType: "PERCENTAGE",
      discountValue: 15,
      active: true,
    },
    create: {
      restaurantId: restaurant.id,
      name: "Happy Hour 15%",
      code: "HAPPY15",
      description: "Auto promo for afternoon traffic",
      discountType: "PERCENTAGE",
      discountValue: 15,
      startAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoApply: false,
      active: true,
    },
  });

  console.log("Seed complete");
  console.log("Restaurant slug: smart-bistro");
  console.log("Admin login: owner@smarttable.ai / admin1234");
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
