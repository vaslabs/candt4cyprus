/** npm run data:validate — schema-validates the source register and every dataset; exits non-zero on error. */
import { loadCyprusDataset } from '../../src/economics/cyprus/defaults';
const { dataset, sources } = loadCyprusDataset();
const missing = dataset.parameters.filter((p) => p.verification === 'missing').map((p) => p.id);
const secondaryStatutory = dataset.parameters
  .filter((p) => p.category === 'statutory' && p.verification === 'verified-secondary')
  .map((p) => p.id);
console.log(`OK: ${dataset.parameters.length} parameters, ${sources.length} sources`);
console.log(`Missing (documented gaps): ${missing.join(', ')}`);
console.log(
  `Statutory values corroborated only by secondary sources: ${secondaryStatutory.join(', ') || 'none'}`,
);
