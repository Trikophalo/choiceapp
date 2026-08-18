import type { CategoryId, DeckProvider } from '@/types'
import { cocktailsProvider } from './cocktails'
import { recipesProvider } from './recipes'
import { moviesProvider } from './movies'
import { activitiesProvider } from './activities'
import { restaurantsProvider } from './restaurants'

export const PROVIDERS: Record<CategoryId, DeckProvider> = {
  restaurants: restaurantsProvider,
  cocktails: cocktailsProvider,
  recipes: recipesProvider,
  movies: moviesProvider,
  activities: activitiesProvider,
}

/** Display order on the home screen. */
export const CATEGORY_ORDER: CategoryId[] = [
  'restaurants',
  'cocktails',
  'recipes',
  'movies',
  'activities',
]

export const CATEGORY_EMOJI: Record<CategoryId, string> = {
  restaurants: '🍽️',
  cocktails: '🍸',
  recipes: '👩‍🍳',
  movies: '🎬',
  activities: '🎯',
}

export function getProvider(category: CategoryId): DeckProvider {
  return PROVIDERS[category]
}

export { hasGooglePlaces } from './restaurants'
export { hasTmdbKey } from './movies'
