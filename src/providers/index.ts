import type { CategoryId, DeckProvider } from '@/types'
import { cocktailsProvider } from './cocktails'
import { recipesProvider } from './recipes'
import { proteinRecipesProvider } from './proteinRecipes'
import { moviesProvider } from './movies'
import { seriesProvider } from './series'
import { animeProvider } from './anime'
import { activitiesProvider } from './activities'
import { restaurantsProvider } from './restaurants'
import { sightsProvider } from './sights'
import { customProvider } from './custom'

export const PROVIDERS: Record<CategoryId, DeckProvider> = {
  restaurants: restaurantsProvider,
  sights: sightsProvider,
  cocktails: cocktailsProvider,
  recipes: recipesProvider,
  proteinRecipes: proteinRecipesProvider,
  movies: moviesProvider,
  series: seriesProvider,
  anime: animeProvider,
  activities: activitiesProvider,
  custom: customProvider,
}

/** Display order on the category screen. */
export const CATEGORY_ORDER: CategoryId[] = [
  'restaurants',
  'sights',
  'cocktails',
  'recipes',
  'proteinRecipes',
  'movies',
  'series',
  'anime',
  'activities',
  'custom',
]

export const CATEGORY_EMOJI: Record<CategoryId, string> = {
  restaurants: '🍽️',
  sights: '🏛️',
  cocktails: '🍸',
  recipes: '👩‍🍳',
  proteinRecipes: '💪',
  movies: '🎬',
  series: '📺',
  anime: '🎌',
  activities: '🎯',
  custom: '🃏',
}

export function getProvider(category: CategoryId): DeckProvider {
  return PROVIDERS[category]
}

export { hasGooglePlaces } from './restaurants'
export { hasTmdbKey } from './movies'
