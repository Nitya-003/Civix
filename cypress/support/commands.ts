declare global {
  namespace Cypress {
    interface Chainable {
      waitForMapToLoad(): Chainable<Element>;
      selectCategoryFilter(category: string): Chainable<Element>;
      setDateRange(from: string, to: string): Chainable<Element>;
      toggleHeatmap(): Chainable<Element>;
      getMarkerClusters(): Chainable<Element>;
      getIndividualMarkers(): Chainable<Element>;
    }
  }
}

Cypress.Commands.add('waitForMapToLoad', () => {
  cy.get('.leaflet-container').should('be.visible');
  cy.get('.leaflet-tile').should('be.visible');
  cy.wait(2000);
});

Cypress.Commands.add('selectCategoryFilter', (category: string) => {
  cy.get(`input[type="checkbox"]`)
    .parent()
    .contains(category)
    .parent()
    .find('input[type="checkbox"]')
    .check();
});

Cypress.Commands.add('setDateRange', (from: string, to: string) => {
  cy.get('input[type="date"]').first().clear().type(from);
  cy.get('input[type="date"]').last().clear().type(to);
});

Cypress.Commands.add('toggleHeatmap', () => {
  cy.get('input[type="checkbox"]')
    .parent()
    .contains('Show Heatmap')
    .parent()
    .find('input[type="checkbox"]')
    .click();
});

Cypress.Commands.add('getMarkerClusters', () => {
  return cy.get('.marker-cluster');
});

// Custom command to get individual markers
Cypress.Commands.add('getIndividualMarkers', () => {
  return cy.get('.custom-marker');
});
