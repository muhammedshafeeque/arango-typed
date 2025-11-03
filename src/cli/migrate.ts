#!/usr/bin/env node

import { MigrationRunner, MigrationRunnerOptions } from '../migration/MigrationRunner';
import { MigrationGenerator } from '../migration/MigrationGenerator';
import { Database } from 'arangojs';

export async function migrate(
  database: Database,
  migrations: any[],
  command: string,
  options: MigrationRunnerOptions & { name?: string } = {}
): Promise<void> {
  const runner = new MigrationRunner(database, migrations);

  switch (command) {
    case 'up':
      await runner.up(options);
      break;
    case 'down':
      await runner.down(options);
      break;
    case 'status':
      const status = await runner.status();
      console.log('Migration Status:');
      console.log(`Total: ${status.total}`);
      console.log(`Executed: ${status.executed.length}`);
      console.log(`Pending: ${status.pending.length}`);
      if (status.executed.length > 0) {
        console.log('\nExecuted migrations:');
        status.executed.forEach((m) => console.log(`  - ${m}`));
      }
      if (status.pending.length > 0) {
        console.log('\nPending migrations:');
        status.pending.forEach((m) => console.log(`  - ${m}`));
      }
      break;
    case 'generate':
      if (!options.name) {
        throw new Error('Migration name is required');
      }
      const generator = new MigrationGenerator();
      const description = (options as any).description;
      const filePath = await generator.generate(options.name, description);
      console.log(`✓ Migration generated: ${filePath}`);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

