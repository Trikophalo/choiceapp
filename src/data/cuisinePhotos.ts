/**
 * Maps an OSM cuisine/amenity to a dish photo strategy: which TheMealDB area
 * or search term carries matching food photography, and a curated Wikimedia
 * Commons query as fallback. TheMealDB is preferred because its images are
 * consistent plated-dish photography; raw Commons search quality varies.
 */
export interface DishPhotoSource {
  /** TheMealDB `filter.php?a=` area whose meal thumbs match this cuisine. */
  mealdbArea?: string
  /** TheMealDB `search.php?s=` term when no whole area fits (e.g. pizza). */
  mealdbSearch?: string
  /** Curated Commons query — the fallback when TheMealDB has nothing. */
  commons: string
}

export const CUISINE_PHOTOS: Record<string, DishPhotoSource> = {
  italian: { mealdbArea: 'Italian', commons: 'italian pasta dish plate' },
  pizza: { mealdbSearch: 'pizza', commons: 'wood fired margherita pizza' },
  pasta: { mealdbArea: 'Italian', commons: 'pasta dish plate' },
  german: { commons: 'schnitzel german food plate' },
  bavarian: { commons: 'bavarian food pretzel sausage' },
  chinese: { mealdbArea: 'Chinese', commons: 'chinese food noodles wok' },
  japanese: { mealdbArea: 'Japanese', commons: 'japanese food bowl' },
  sushi: { commons: 'sushi platter nigiri maki' },
  ramen: { commons: 'ramen bowl noodles' },
  indian: { mealdbArea: 'Indian', commons: 'indian curry thali' },
  mexican: { mealdbArea: 'Mexican', commons: 'mexican tacos plate' },
  thai: { mealdbArea: 'Thai', commons: 'thai curry pad thai' },
  greek: { mealdbArea: 'Greek', commons: 'greek food gyros plate' },
  turkish: { mealdbArea: 'Turkish', commons: 'turkish food kebap plate' },
  kebab: { commons: 'doner kebab' },
  french: { mealdbArea: 'French', commons: 'french cuisine plated dish' },
  spanish: { mealdbArea: 'Spanish', commons: 'paella pan spanish food' },
  tapas: { mealdbArea: 'Spanish', commons: 'tapas plates spanish' },
  vietnamese: { mealdbArea: 'Vietnamese', commons: 'pho bowl vietnamese' },
  korean: { commons: 'korean food bibimbap' },
  american: { mealdbArea: 'American', commons: 'burger fries american diner food' },
  burger: { commons: 'cheeseburger fries' },
  steak_house: { commons: 'grilled steak plate' },
  bbq: { commons: 'barbecue grilled meat platter' },
  seafood: { mealdbArea: 'Irish', mealdbSearch: 'salmon', commons: 'seafood platter' },
  fish: { mealdbSearch: 'fish', commons: 'grilled fish plate' },
  fish_and_chips: { mealdbSearch: 'fish', commons: 'fish and chips' },
  portuguese: { mealdbArea: 'Portuguese', commons: 'portuguese food dish' },
  polish: { mealdbArea: 'Polish', commons: 'pierogi polish food' },
  russian: { mealdbArea: 'Russian', commons: 'russian food pelmeni' },
  croatian: { mealdbArea: 'Croatian', commons: 'croatian food dish' },
  filipino: { mealdbArea: 'Filipino', commons: 'filipino food dish' },
  malaysian: { mealdbArea: 'Malaysian', commons: 'malaysian food dish' },
  moroccan: { mealdbArea: 'Moroccan', commons: 'moroccan tagine' },
  lebanese: { commons: 'lebanese mezze plates' },
  persian: { commons: 'persian food rice kebab' },
  ethiopian: { commons: 'ethiopian injera platter' },
  vegan: { commons: 'vegan bowl colorful vegetables' },
  vegetarian: { mealdbArea: 'Indian', commons: 'vegetarian dish plate' },
  ice_cream: { commons: 'ice cream scoops cone' },
  dessert: { mealdbSearch: 'cake', commons: 'dessert cake slice' },
  cake: { mealdbSearch: 'cake', commons: 'layer cake slice' },
  breakfast: { mealdbSearch: 'pancake', commons: 'breakfast plate pancakes' },
  brunch: { mealdbSearch: 'pancake', commons: 'brunch table food' },
  sandwich: { commons: 'sandwich baguette deli' },
  chicken: { mealdbSearch: 'chicken', commons: 'roast chicken plate' },
  noodle: { commons: 'noodle bowl asian' },
  asian: { mealdbArea: 'Thai', commons: 'asian food bowls' },
  international: { mealdbArea: 'French', commons: 'restaurant plated dish gourmet' },
  regional: { commons: 'restaurant plated dish' },
  mediterranean: { mealdbArea: 'Greek', commons: 'mediterranean food plates' },
  falafel: { commons: 'falafel plate hummus' },
  sushi_bar: { commons: 'sushi platter' },
}

/** amenity-level defaults when the element has no usable cuisine tag. */
export const AMENITY_PHOTOS: Record<string, DishPhotoSource> = {
  cafe: { commons: 'cappuccino latte art coffee cup' },
  bar: { commons: 'cocktail bar drinks' },
  pub: { commons: 'craft beer glasses pub' },
  fast_food: { commons: 'burger french fries' },
  restaurant: { mealdbArea: 'French', commons: 'restaurant plated dish' },
}
