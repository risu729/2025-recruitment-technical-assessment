import express, { type Request, type Response } from "express";
import z from "zod";

// ==== Type Definitions, feel free to add or modify ==========================
const cookbookEntrySchema = z.union([
  z.object({
    type: z.literal("recipe"),
    name: z.string().min(1),
    requiredItems: z
      .array(
        z.object({
          name: z.string().min(1),
          quantity: z.number().int().positive(),
        }),
      )
      .nonempty()
      .refine(
        (items) =>
          new Set(items.map((item) => item.name)).size === items.length,
        {
          message: "no duplicate requiredItems allowed",
        },
      ),
  }),
  z.object({
    type: z.literal("ingredient"),
    name: z.string().min(1),
    cookTime: z.number().int().nonnegative(),
  }),
]);
type CookbookEntry = z.infer<typeof cookbookEntrySchema>;

// =============================================================================
// ==== HTTP Endpoint Stubs ====================================================
// =============================================================================
const app = express();
app.use(express.json());

// Store your recipes here!
const cookbook = new Map<string, CookbookEntry>();

// Task 1 helper (don't touch)
app.post("/parse", (req:Request, res:Response) => {
  const { input } = req.body;

  const parsed_string = parse_handwriting(input)
  if (parsed_string == null) {
    res.status(400).send("this string is cooked");
    return;
  } 
  res.json({ msg: parsed_string });
  return;
});

// [TASK 1] ====================================================================
// Takes in a recipeName and returns it in a form that 
const parse_handwriting = (recipeName: string): string | null => {
  const name = recipeName
    .toLowerCase()
    .replaceAll(/[^a-z _-]/g, "")
    .split(/[ _-]+/g)
    .map((word) => (word.at(0)?.toUpperCase() ?? "") + word.slice(1))
    .join(" ");
  return name.length > 0 ? name : null;
};

// [TASK 2] ====================================================================
// Endpoint that adds a CookbookEntry to your magical cookbook
app.post("/entry", (req: Request, res: Response) => {
  const parsedEntry = cookbookEntrySchema.safeParse(req.body);
  if (!parsedEntry.success) {
    res.status(400).send(parsedEntry.error.errors);
    return;
  }
  if (cookbook.has(parsedEntry.data.name)) {
    res
      .status(400)
      .send(`entry with name ${parsedEntry.data.name} already exists`);
    return;
  }
  cookbook.set(parsedEntry.data.name, parsedEntry.data);
  res.send(`entry with name ${parsedEntry.data.name} added`);
});

// [TASK 3] ====================================================================
// Endpoint that returns a summary of a recipe that corresponds to a query name
const deepMap = <T>(arr: T[], fn: (val: T) => T | T[]): T[] =>
  arr.flatMap((val) => {
    const mapped = fn(val);
    return Array.isArray(mapped) ? deepMap(mapped, fn) : mapped;
  });

app.get("/summary", (req: Request, res: Response) => {
  const { name } = req.query as { name: string };
  console.log(name);
  const entry = cookbook.get(name);
  if (entry === undefined) {
    res.status(400).send(`entry with name ${name} does not exist`);
    return;
  }
  if (entry.type !== "recipe") {
    res.status(400).send(`entry with name ${name} is not a recipe`);
    return;
  }
  let ingredients: typeof entry.requiredItems[number][];
  try {
    ingredients = deepMap(entry.requiredItems, (item) => {
      const entry = cookbook.get(item.name);
      if (entry === undefined) {
        throw new Error(`entry with name ${item.name} does not exist`);
      }
      return entry?.type === "recipe" ? entry.requiredItems : item;
    }).reduce<typeof ingredients>((acc, item) => {
      const existing = acc.find((i) => i.name === item.name);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        acc.push(item);
      }
      return acc;
    }, []);
  } catch (e) {
    res.status(400).send(e instanceof Error ? e.message : e);
    return;
  }
  res.json({
    name: entry.name,
    cookTime: ingredients.reduce((acc, item) => {
      const entry = cookbook.get(item.name);
      return acc + (entry?.type === "ingredient" ? entry.cookTime : 0);
    }, 0),
    ingredients,
  });
});

// =============================================================================
// ==== DO NOT TOUCH ===========================================================
// =============================================================================
const port = 8080;
app.listen(port, () => {
  console.log(`Running on: http://127.0.0.1:8080`);
});
