/**
 * Maps an OSM cuisine/amenity to a dish photo strategy: which TheMealDB area
 * or search term carries matching food photography, and a curated Wikimedia
 * Commons query as fallback. TheMealDB is preferred because its images are
 * consistent plated-dish photography; raw Commons search quality varies.
 */
export interface DishPhotoSource {
  /** English Wikipedia dish articles whose lead image should represent this
   *  cuisine — article lead images are curated and consistently attractive,
   *  so this tier is tried FIRST. Several titles give per-card variety. */
  wiki?: string[]
  /** TheMealDB `filter.php?a=` area whose meal thumbs match this cuisine. */
  mealdbArea?: string
  /** TheMealDB `search.php?s=` term when no whole area fits (e.g. pizza). */
  mealdbSearch?: string
  /** Curated Commons query — the last-resort fallback. */
  commons: string
}

export const CUISINE_PHOTOS: Record<string, DishPhotoSource> = {
  italian: { wiki: ['Pizza Margherita', 'Spaghetti alla carbonara', 'Lasagne', 'Risotto'], mealdbArea: 'Italian', commons: 'italian pasta dish plate' },
  pizza: { wiki: ['Pizza Margherita', 'Neapolitan pizza', 'Pizza'], mealdbSearch: 'pizza', commons: 'wood fired margherita pizza' },
  pasta: { wiki: ['Spaghetti alla carbonara', 'Lasagne', 'Penne'], mealdbArea: 'Italian', commons: 'pasta dish plate' },
  german: { wiki: ['Schnitzel', 'Bratwurst', 'Spätzle', 'Sauerbraten'], commons: 'schnitzel german food plate' },
  bavarian: { wiki: ['Weisswurst', 'Pretzel', 'Schweinshaxe'], commons: 'bavarian food pretzel sausage' },
  chinese: { wiki: ['Kung Pao chicken', 'Dim sum', 'Chow mein', 'Peking duck'], mealdbArea: 'Chinese', commons: 'chinese food noodles wok' },
  japanese: { wiki: ['Sushi', 'Ramen', 'Tempura', 'Tonkatsu'], mealdbArea: 'Japanese', commons: 'japanese food bowl' },
  sushi: { wiki: ['Sushi', 'Sashimi', 'Makizushi'], commons: 'sushi platter nigiri maki' },
  ramen: { wiki: ['Ramen'], commons: 'ramen bowl noodles' },
  indian: { wiki: ['Butter chicken', 'Biryani', 'Chicken tikka masala', 'Naan'], mealdbArea: 'Indian', commons: 'indian curry thali' },
  mexican: { wiki: ['Taco', 'Burrito', 'Quesadilla', 'Guacamole'], mealdbArea: 'Mexican', commons: 'mexican tacos plate' },
  thai: { wiki: ['Pad thai', 'Green curry', 'Tom yum'], mealdbArea: 'Thai', commons: 'thai curry pad thai' },
  greek: { wiki: ['Gyros', 'Moussaka', 'Souvlaki', 'Greek salad'], mealdbArea: 'Greek', commons: 'greek food gyros plate' },
  turkish: { wiki: ['Doner kebab', 'Lahmacun', 'Baklava', 'Köfte'], mealdbArea: 'Turkish', commons: 'turkish food kebap plate' },
  kebab: { wiki: ['Doner kebab', 'Shish kebab', 'Dürüm'], commons: 'doner kebab' },
  french: { wiki: ['Coq au vin', 'Ratatouille', 'Crêpe', 'Bouillabaisse'], mealdbArea: 'French', commons: 'french cuisine plated dish' },
  spanish: { wiki: ['Paella', 'Tapas', 'Spanish omelette', 'Gazpacho'], mealdbArea: 'Spanish', commons: 'paella pan spanish food' },
  tapas: { wiki: ['Tapas', 'Patatas bravas', 'Croquette'], mealdbArea: 'Spanish', commons: 'tapas plates spanish' },
  vietnamese: { wiki: ['Pho', 'Bánh mì', 'Spring roll'], mealdbArea: 'Vietnamese', commons: 'pho bowl vietnamese' },
  korean: { wiki: ['Bibimbap', 'Korean barbecue', 'Bulgogi', 'Kimchi'], commons: 'korean food bibimbap' },
  american: { wiki: ['Hamburger', 'Hot dog', 'Barbecue', 'Macaroni and cheese'], mealdbArea: 'American', commons: 'burger fries american diner food' },
  burger: { wiki: ['Cheeseburger', 'Hamburger'], commons: 'cheeseburger fries' },
  steak_house: { wiki: ['Steak', 'Rib eye steak', 'T-bone steak'], commons: 'grilled steak plate' },
  bbq: { wiki: ['Barbecue', 'Spare ribs', 'Pulled pork'], commons: 'barbecue grilled meat platter' },
  seafood: { wiki: ['Seafood', 'Lobster', 'Fish and chips'], mealdbArea: 'Irish', mealdbSearch: 'salmon', commons: 'seafood platter' },
  fish: { wiki: ['Fried fish', 'Fish and chips'], mealdbSearch: 'fish', commons: 'grilled fish plate' },
  fish_and_chips: { wiki: ['Fish and chips'], mealdbSearch: 'fish', commons: 'fish and chips' },
  portuguese: { wiki: ['Pastel de nata', 'Bacalhau', 'Francesinha'], mealdbArea: 'Portuguese', commons: 'portuguese food dish' },
  polish: { wiki: ['Pierogi', 'Bigos'], mealdbArea: 'Polish', commons: 'pierogi polish food' },
  russian: { wiki: ['Pelmeni', 'Borscht', 'Blini'], mealdbArea: 'Russian', commons: 'russian food pelmeni' },
  croatian: { wiki: ['Ćevapi'], mealdbArea: 'Croatian', commons: 'croatian food dish' },
  filipino: { wiki: ['Philippine adobo', 'Lumpia', 'Sinigang'], mealdbArea: 'Filipino', commons: 'filipino food dish' },
  malaysian: { wiki: ['Nasi lemak', 'Laksa', 'Satay'], mealdbArea: 'Malaysian', commons: 'malaysian food dish' },
  moroccan: { wiki: ['Tajine', 'Couscous'], mealdbArea: 'Moroccan', commons: 'moroccan tagine' },
  lebanese: { wiki: ['Hummus', 'Falafel', 'Tabbouleh', 'Shawarma'], commons: 'lebanese mezze plates' },
  persian: { wiki: ['Chelow kabab', 'Ghormeh sabzi'], commons: 'persian food rice kebab' },
  ethiopian: { wiki: ['Injera', 'Doro wat'], commons: 'ethiopian injera platter' },
  vegan: { wiki: ['Veggie burger', 'Falafel', 'Salad'], commons: 'vegan bowl colorful vegetables' },
  vegetarian: { wiki: ['Paneer', 'Falafel', 'Salad'], mealdbArea: 'Indian', commons: 'vegetarian dish plate' },
  ice_cream: { wiki: ['Ice cream', 'Sundae', 'Gelato'], commons: 'ice cream scoops cone' },
  dessert: { wiki: ['Cheesecake', 'Tiramisu', 'Chocolate cake'], mealdbSearch: 'cake', commons: 'dessert cake slice' },
  cake: { wiki: ['Chocolate cake', 'Cheesecake', 'Black Forest gateau'], mealdbSearch: 'cake', commons: 'layer cake slice' },
  breakfast: { wiki: ['Pancake', 'Full breakfast', 'French toast'], mealdbSearch: 'pancake', commons: 'breakfast plate pancakes' },
  brunch: { wiki: ['Eggs Benedict', 'Pancake', 'Avocado toast'], mealdbSearch: 'pancake', commons: 'brunch table food' },
  sandwich: { wiki: ['Sandwich', 'Club sandwich', 'BLT'], commons: 'sandwich baguette deli' },
  chicken: { wiki: ['Fried chicken', 'Roast chicken'], mealdbSearch: 'chicken', commons: 'roast chicken plate' },
  noodle: { wiki: ['Ramen', 'Chow mein', 'Pad thai'], commons: 'noodle bowl asian' },
  asian: { wiki: ['Ramen', 'Dim sum', 'Bibimbap'], mealdbArea: 'Thai', commons: 'asian food bowls' },
  international: { mealdbArea: 'French', commons: 'restaurant plated dish gourmet' },
  regional: { commons: 'restaurant plated dish' },
  mediterranean: { wiki: ['Meze', 'Greek salad', 'Hummus'], mealdbArea: 'Greek', commons: 'mediterranean food plates' },
  falafel: { wiki: ['Falafel'], commons: 'falafel plate hummus' },
  sushi_bar: { wiki: ['Sushi', 'Sashimi'], commons: 'sushi platter' },
}

/** amenity-level defaults when the element has no usable cuisine tag. */
export const AMENITY_PHOTOS: Record<string, DishPhotoSource> = {
  cafe: { wiki: ['Cappuccino', 'Latte art', 'Espresso', 'Latte macchiato'], commons: 'cappuccino latte art coffee cup' },
  bar: { wiki: ['Cocktail', 'Negroni', 'Old fashioned (cocktail)'], commons: 'cocktail bar drinks' },
  pub: { wiki: ['Beer', 'Craft beer', 'India pale ale'], commons: 'craft beer glasses pub' },
  fast_food: { wiki: ['Hamburger', 'French fries', 'Cheeseburger'], commons: 'burger french fries' },
  restaurant: { mealdbArea: 'French', commons: 'restaurant plated dish' },
}
