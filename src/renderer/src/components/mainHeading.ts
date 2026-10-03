/**
 * The id of the heading that names the main landmark. Whichever view fills
 * `<main>` puts this id on its one level-1 heading, so the landmark takes that
 * view's name and a screen reader announces it when focus lands there. Only one
 * view renders at a time, so the id is unique.
 */
export const MAIN_HEADING_ID = 'main-heading'
