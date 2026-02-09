/**
 * Standard animation configurations for consistent motion design
 */

export const animations = {
  /**
   * Spring animation for natural physics-based motion
   */
  spring: {
    damping: 15,
    stiffness: 150,
  },

  /**
   * Stiff spring for snappy interactions
   */
  springStiff: {
    damping: 10,
    stiffness: 300,
  },

  /**
   * Soft spring for gentle animations
   */
  springSoft: {
    damping: 20,
    stiffness: 100,
  },

  /**
   * Fade duration
   */
  fade: {
    duration: 300,
  },

  /**
   * Slide duration
   */
  slide: {
    duration: 250,
  },

  /**
   * Scale duration
   */
  scale: {
    damping: 10,
    stiffness: 300,
  },

  /**
   * Stagger delay for list animations
   */
  stagger: {
    delay: 50,
  },

  /**
   * Long duration for slow transitions
   */
  slow: {
    duration: 500,
  },
};

/**
 * Predefined easing functions
 */
export const easings = {
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  bouncy: [0.175, 0.885, 0.32, 1.275],
};
