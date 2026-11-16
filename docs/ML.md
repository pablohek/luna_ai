# Future machine-learning evaluation

The live forecast is deterministic and uses only period start dates. The optional `backend/requirements-ml.txt` provides scikit-learn and XGBoost for a separate research environment. No model is trained or served by this project.

1. Obtain permissioned longitudinal data with documented collection, missingness, withdrawal and consent for model research. Keep research data separate from operational accounts and logs, with limited access. Synthetic entries can exercise code paths.
2. Define the target as days from the last known period start to the next recorded start. Calculate features strictly from information available at the prediction date. Define how missing and potentially unlogged cycles enter evaluation.
3. Use person-disjoint evaluation and time-ordered backtesting within available histories. Evaluate the shipped median baseline under identical inclusion and eligibility rules. Fit candidate scikit-learn and XGBoost regressors on training users only, tune on validation data and keep the final test data held out.
4. Report absolute error in days, empirical window coverage, interval width and the proportion receiving predictions. Examine irregular histories and different amounts of logged history, with participant-level uncertainty estimates. Include how missed logs affect the measurements.
5. Set acceptance criteria before viewing held-out results. Integrate an explicitly labeled trained model only after it demonstrates a meaningful improvement over the baseline at a comparable width and coverage, and after privacy and operational review.
