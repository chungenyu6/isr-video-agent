export const layers = [
    ['L0', 'Was an answer submitted?', ['no_submission', 'invalid_submission']],
    ['L1', 'Were the targets tracked?', ['missed_targets']],
    ['L2', 'Were vehicles split or merged?', ['target_fragmented', 'target_split', 'target_merged']],
    ['L3', 'Did the traffic rule select the right vehicles?', ['rule_FN', 'rule_FP', 'coverage_gap']],
    ['L4', 'Were the visual observations correct?', ['color_FN', 'color_FP', 'identity_wrong_same', 'identity_wrong_different']],
    ['L5', 'What did the agent adopt and cite?', ['unsupported_claims', 'missing_support', 'agent_adopted_wrong']],
    ['L6', 'What was wrong in the final answer?', ['answer_FN', 'answer_FP', 'answer_color_miss', 'abstention', 'unknown', 'count_complete_overclaim']],
] as const;
export const definitions: Record<string, string> = {
    no_submission: 'No submission was recorded.', invalid_submission: 'A submission exists but fails the answer schema.', missed_targets: 'Ground-truth targets with no geometrically matched track.',
    target_fragmented: 'A target occupies multiple vehicle records before Pi. Informational: these records may still share one counting unit.', target_split: 'A target occupies multiple opposing counting units before Pi.', target_merged: 'One pre-Pi vehicle record contains tracks matched to multiple targets.',
    rule_FN: 'Tracked targets with no opposing counting unit before Pi.', rule_FP: 'Opposing counting units with no geometrically matched target before Pi.', coverage_gap: 'Opposing target units not covered by an appearance check.',
    color_FN: 'Appearance observations omit a target’s labelled main colour.', color_FP: 'A stated appearance colour overlaps none of the target’s labelled visible colours.', identity_wrong_same: 'A parsed “same” observation disagrees with the geometric object mapping.', identity_wrong_different: 'A parsed “different” observation disagrees with the geometric object mapping.',
    unsupported_claims: 'A resolved identity finding contradicts all parseable cited correspondence observations. This is a specific check, not a general claim verifier.', missing_support: 'Reported targets with no colour observation reference.', agent_adopted_wrong: 'Resolved identity or appearance findings disagree with the evaluator’s object or visible-colour mapping.',
    answer_FN: 'Ground-truth targets not matched to a reported vehicle.', answer_FP: 'Reported vehicles not matched to a ground-truth target.', answer_color_miss: 'Matched reported targets omit their labelled main colour.', abstention: 'A valid submission abstains.', unknown: 'Final colour entries explicitly say “unknown”.', count_complete_overclaim: 'count_complete is true while the reported count differs from the oracle count.',
};
export const names: Record<string, string> = { random: 'Random', ce: 'CE', thompson: 'Thompson' };
export const binLabel: Record<string, string> = { S1_2to7: '2–<7', S2_7to12: '7–<12', S3_12to17: '12–<17', S4_17to22: '17–22' };
