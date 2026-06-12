// vpc-ownership.test.ts — removed.
// The VPC cross-stack ownership test referenced ComputeStack which has been
// deleted in favour of LambdaStack (no VPC attachment). Lambda runs outside
// any VPC; RDS is publicly accessible. This file is intentionally a no-op.

test('vpc-ownership tests removed with ComputeStack', () => {
  // ComputeStack deleted — VPC cross-stack sharing no longer applies.
  expect(true).toBe(true);
});
