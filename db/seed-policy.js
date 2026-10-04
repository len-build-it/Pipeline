export function assertSeedAllowed(nodeEnv) {
  if (nodeEnv === 'production') {
    throw new Error('The development seed command is not allowed in production.');
  }
}
