import prompts from 'prompts';

import type { CollisionDecision, LinkConflict } from '../lib/types';

// Interactive collision resolver for --collision prompt.
// Returning "abort" bubbles up as an error to stop the current serve run.
export async function promptCollisionResolver(
  conflict: LinkConflict,
): Promise<CollisionDecision> {
  const response = await prompts(
    {
      type: 'select',
      name: 'decision',
      message: `command "${conflict.name}" already exists`,
      choices: [
        {
          title: 'Overwrite existing command',
          value: 'overwrite',
          description: `Replace ${conflict.linkPath}`,
        },
        {
          title: 'Skip this command',
          value: 'skip',
          description: conflict.reason,
        },
        {
          title: 'Abort',
          value: 'abort',
          description: 'Stop serve without linking remaining commands',
        },
      ],
      initial: 1,
    },
    {
      onCancel: () => false,
    },
  );

  if (!response.decision) {
    return 'abort';
  }

  return response.decision as CollisionDecision;
}
