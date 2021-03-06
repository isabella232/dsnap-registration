import { assign , actions} from 'xstate';
import { isAffirmative, isPrimitive } from 'utils';
import testData from './test-data';
import modelState from 'models';
import config from 'models/config';
import disaster from 'models/disaster';
import { hasMailingAddress } from 'models/basic-info';
import {
  getHouseholdCount,
  getMembers,
  hasAdditionalMembers,
  updateMemberAtIndex,
  decrementMemberIndex,
  getMemberAtIndex,
  getApplicant,
} from 'models/household';
import { hasJob, hasOtherJobs, getIncome, getJobs, getFullName } from 'models/person';
import { getDisasters } from 'services/disaster';
import { createRegistration } from 'services/registration';
import { createEligibility } from 'services/eligibility';
import job from 'models/job';
import {
  pendingMembersWithResources,
  updateCurrentMemberIndex,
  getCurrentResourceHolderId
} from 'models/resources';
import { memberJobs } from 'services/member-jobs';

const STATE_KEY = 'dsnap-registration';
// ignore these when running the persistence algo, the context is responsible
// for managing the meta state of the machine
const ignoreKeys = [
  'currentSection',
  'currentStep',
  'errors',
  'disasters',
  'meta'
];

const defaultAppState = {
  ...modelState,
  currentSection: 'welcome',
  currentStep: '',
  previousStep: '',
  previousSection: '',
  errors: '',
  disasters: disaster(),
  meta: {
    loading: undefined
  },
  config: config(),
  /**
   * totalSteps refers to the number of sections a user will move through
   * while filling out the form. It doesn't necessarily reflect
   * the number of states the machine can be in.
   *
   * For example, the `quit` state is used internally by the state machine
   * but is not exposed to the user. Therefore, it is not included in the total
   * number of steps
   */
  totalSteps: 6,
};

const initialState = () => {
  const loadState = process.env.REACT_APP_LOAD_STATE;
  const stateExists = localStorage.getItem(STATE_KEY);

  if (loadState && !stateExists) {
    localStorage.setItem(STATE_KEY, JSON.stringify(testData));
    return testData;
  }

  const machineState = defaultAppState;

  let state;

  try {
    state = JSON.parse(localStorage.getItem(STATE_KEY)) || machineState;
  } catch(error) {
    state = machineState;
  }

  return state;
};

const formNextHandler = (target, extraActions = []) => ({
  NEXT: {
    target,
    internal: true,
    actions: [
      () => console.log(`transitioning to next step ${target}`),
      ...extraActions,
      'persist',
      assign((_, event) => {
        const { type, ...rest } = event;

        return {
          ...rest
        };
      }),
    ]
  }
});

const basicInfoChart = {
  id: 'basic-info',
  internal: true,
  initial: 'applicant-name',
  onEntry: [
    assign({
      currentSection: 'basic-info',
      step: 1,
    }),
    'persist'
  ],
  onExit: [
    assign({ previousSection: 'basic-info' }),
    'persist',
  ],
  states: {
    'applicant-name': {
      on: {
        ...formNextHandler('address')
      },
      meta: {
        path: '/form/basic-info/applicant-name'
      },
      onEntry: [
        () => console.log('enter applicant name'),
        assign({ currentStep: 'applicant-name' })
      ],
      onExit: [
        assign({ previousStep: 'applicant-name' }),
      ]
    },
    address: {
      on: {
        ...formNextHandler('mailing-address-check'),
      },
      meta: {
        path: '/form/basic-info/address'
      },
      onEntry: [
        assign({ currentStep: 'address' })
      ],
      onExit: [
        assign({ previousStep: 'address' })
      ]
    },
    'mailing-address-check': {
      on: {
        '': [
          {
            target: 'mailing-address',
            cond: (context) => hasMailingAddress(context.basicInfo)
          },
          {
            target: 'shortcut',
            cond: (context) => !hasMailingAddress(context.basicInfo)
          },
        ],
      },
    },
    'mailing-address': {
      on: {
        ...formNextHandler('shortcut')
      },
      meta: {
        path: '/form/basic-info/mailing-address',
      },
      onEntry: [
        assign({ currentStep: 'mailing-address'})
      ],
      onExit: [
        assign({ previousStep: 'mailing-address' })
      ],
    },
    shortcut: {
      on: {
        EXIT: {
          target: '#submit',
        },
        ...formNextHandler('#identity'),
      },
      meta: {
        path: '/form/basic-info/shortcut'
      },
      onEntry: [
        assign({ currentStep: 'shortcut' })
      ],
      onExit: [
        assign({ previousStep: 'shortcut'})
      ]
    }
  },
};

const identityChart = {
  id: 'identity',
  initial: 'personal-info',
  onEntry: [
    assign({
      currentSection: 'identity',
      step: 2,
    })
  ],
  onExit: [
    assign({ previousSection: 'identity' }),
  ],
  states: {
    'personal-info': {
      onEntry: [
        assign({ currentStep: 'personal-info' })
      ],
      onExit: [
        assign({ previousStep: 'personal-info' })
      ],
      on: {
        ...formNextHandler('#household')
      },
      meta: {
        path: '/form/identity/personal-info',
      },
    },
  }
};

const householdChart = {
  id: 'household',
  initial: 'how-many',
  onEntry: [
    assign({
      currentSection: 'household',
      step: 3,
    })
  ],
  onExit: [
    assign({ previousSection: 'household' }),
  ],
  on: {
    DECREMENT_CURRENT_MEMBER_INDEX: [
      {
        target: '.get-prepared',
        internal: true,
        cond: (ctx) => {
          return ctx.household.currentMemberIndex === 0;
        },
      },
      {
        internal: true,
        target: '.member-details-loop',
        cond: (ctx) => {
          return ctx.household.currentMemberIndex !== 0;
        },
        actions: [
          assign({
            household: (ctx) => {
              return {
                ...ctx.household,
                currentMemberIndex: decrementMemberIndex(ctx.household)
              }
            }
          }),
          'persist'
        ]
      }
    ]
  },
  strict: true,
  states: {
    'how-many': {
      on: {
        ...formNextHandler('member-info-branch')
      },
      meta: {
        path: '/form/household/how-many',
      },
      onEntry: [
        assign({ currentStep: 'how-many' }),
        'persist'
      ],
      onExit: [
        assign({ previousStep: 'how-many' }),
        'persist'
      ],
    },
    'member-info-branch': {
      on: {
        '': [
          {
            target: 'member-names',
            cond: (context) => {
              return getHouseholdCount(context.household) > 1;
            }
          },
          {
            target: 'food-assistance',
            cond: (context) => {
              return getHouseholdCount(context.household) === 1;
            }
          },
        ],
      },
    },
    'member-names': {
      onEntry: [
        assign({ currentStep: 'member-names' }),
        'persist',
      ],
      onExit: [
        assign({ previousStep: 'member-names' }),
        'persist',
      ],
      on: {
        ...formNextHandler('get-prepared')
      },
      meta: {
        path: '/form/household/member-names',
      }
    },
    'get-prepared': {
      onEntry: [
        assign({ currentStep: 'get-prepared' }),
        'persist',
      ],
      onExit: [
        assign({ previousStep: 'get-prepared' }),
        'persist',
      ],
      on: {
        ...formNextHandler('member-details-loop')
      },
      meta: {
        path: '/form/household/get-prepared',
      }
    },
    'member-details': {
      onEntry: [
        assign({
          currentStep: 'member-details',
        }),
        'persist'
      ],
      onExit: [
        assign({ previousStep: 'member-details' }),
        'persist'
      ],
      on: {
        ...formNextHandler('member-details-loop'),
        '': {
          target: 'member-details-loop',
          cond: (context) => {
            return !hasAdditionalMembers(context.household);
          },
          actions: [ actions.send('DECREMENT_CURRENT_MEMBER_INDEX') ]
        }
      },
      meta: {
        path: '/form/household/member-details',
      }
    },
    'member-details-loop': {
      internal: true,
      on: {
        '': [
          {
            target: 'member-details',
            cond: (context) => {
              return hasAdditionalMembers(context.household)
            }
          },
          {
            target: 'food-assistance',
            cond: (context) => {
              return !hasAdditionalMembers(context.household);
            }
          }
        ],
      },
    },
    'food-assistance': {
      onEntry: [
        assign({ currentStep: 'food-assistance' }),
        'persist'
      ],
      onExit: [
        assign({ previousStep: 'food-assistance' }),
        'persist'
      ],
      meta: {
        path: '/form/household/food-assistance'
      },
      on: {
        ...formNextHandler('#impact')
      }
    }
  }
};

const impactChart = {
  id: 'impact',
  initial: 'adverse-effects',
  onEntry: [
    assign({
      currentSection: 'impact',
      step: 4,
    }),
    'persist',
  ],
  onExit: [
    assign({ previousSection: 'impact' }),
    'persist'
  ],
  strict: true,
  states: {
    'adverse-effects': {
      onEntry: [
        assign({ currentStep: 'adverse-effects' }),
        'persist',
      ],
      onExit: [
        assign({ previousStep: 'adverse-effects' }),
        'persist',
      ],
      meta: {
        path: '/form/impact/adverse-effects'
      },
      on: {
        ...formNextHandler('#resources'),
      },
    }
  }
};

const resourcesChart = {
  id: 'resources',
  initial: 'assets',
  internal: true,
  strict: true,
  onEntry: [
    assign({
      currentSection: 'resources',
      step: 5,
    }),
    'persist'
  ],
  onExit: [
    assign({ previousSection: 'resources' }),
    'persist'
  ],
  on: {
    DECREMENT_CURRENT_MEMBER_INDEX: [
      {
        target: '.assets',
        internal: true,
        cond: (ctx) => {
          return ctx.resources.currentMemberIndex === 0;
        },
      },
      {
        internal: true,
        target: '.check-member',
        cond: (ctx) => {
          return ctx.resources.currentMemberIndex !== 0;
        },
        actions: [
          assign({
            resources: (ctx) => {
              const currentMemberIndex = ctx.resources.currentMemberIndex;
              const membersWithIncomeLen = ctx.resources.membersWithIncome.length;
              let modifier = -1;
              
              // This handle the (edge) case where the user clicks the back button and the browser
              // history listener doesnt fire. We need to decrement to currentMemberIndex by more than 1
              if (currentMemberIndex >= membersWithIncomeLen) {
                modifier = -(membersWithIncomeLen);
              }
              return {
                ...ctx.resources,
                currentMemberIndex: updateCurrentMemberIndex(ctx.resources, modifier)
              }
            }
          }),
          'persist'
        ]
      }
    ],
    DECREMENT_CURRENT_JOB_INDEX: [
      {
        /**
         * wee cant redirect to the income branch becuase the code will see that the current
         * member's index has been decremented and skip the income screen of the last user
         * additionally, this will break on the final member, since the currentMemberIndex
         * will be set to a negative number.
         * 
         * We also cant redirect just to the jobs-branch, since that will cuase the code to immediately
         * redirect to the income page since the next user has jobs, and redirecting there resets
         * the currentJobIndex to zero.
         * 
         * Therefore, we need a third state that is only accessible from this branch, that 
         * decrements the member index and sends the user back to the jobs page if they have jobs,
         * or to the income branch if they dont. alternatively, we could potentially use the other-jobs branch
         */
        target: '.income-branch',
        cond: (ctx) => {
          const memberIndex = getCurrentResourceHolderId(ctx.resources);
          const member = getMembers(ctx.household)[memberIndex];
          const income = getIncome(member);

          return income.currentJobIndex <= 0;
        },
        actions: [
          assign({
            resources: (ctx) => {
              let indexOffset = -1;

              if (ctx.resources.currentMemberIndex - 1 < 0) {
                indexOffset = 0;
              }

              return {
                ...ctx.resources,
                currentMemberIndex: updateCurrentMemberIndex(ctx.resources, indexOffset)
              }
            },
            household: (ctx) => {
              const memberIndex = getCurrentResourceHolderId(ctx.resources);
              const member = getMembers(ctx.household)[memberIndex];
              const income = getIncome(member);

              const nextMember = {
                ...member,
                hasOtherJobs: income.jobs.length ? true : false,
                assetsAndIncome: {
                  ...income,
                  currentJobIndex: income.currentJobIndex - 1,
                },
              };
              return updateMemberAtIndex(ctx.household, memberIndex, nextMember);
            },
          }),
          'persist'
        ]
      },
      {
        target: '.jobs-branch',
        internal: true,
        cond: (ctx) => {
          const memberIndex = getCurrentResourceHolderId(ctx.resources);
          const member = getMembers(ctx.household)[memberIndex];
          const income = getIncome(member);

          return income.currentJobIndex > 0;
        },
        actions: [
          assign({
            household: (ctx) => {
              const memberIndex = getCurrentResourceHolderId(ctx.resources);
              const member = getMembers(ctx.household)[memberIndex];
              const income = getIncome(member);

              const nextMember = {
                ...member,
                hasOtherJobs: income.jobs.length ? true : false,
                assetsAndIncome: {
                  ...income,
                  currentJobIndex: income.currentJobIndex - 1,
                },
              };
              return updateMemberAtIndex(ctx.household, memberIndex, nextMember);
            },
            resources: (ctx) => {
              let indexOffset = -1;

              if (ctx.resources.currentMemberIndex - 1 < 0) {
                indexOffset = 0;
              }
              // only decrement if they dont have jobs?

              return {
                ...ctx.resources,
                currentMemberIndex: updateCurrentMemberIndex(ctx.resources, indexOffset)
              }
            }
          }),
          'persist'
        ]
      }
    ]
  },
  states: {
    assets: {
      internal: true,
      onEntry: [
        assign({
          currentStep: 'assets',
          resources: (ctx) => ({
            ...ctx.resources,
            currentMemberIndex: 0
          })
        }),
        'persist',
      ],
      onExit: [
        assign({ previousStep: 'assets' }),
        'persist',
      ],
      meta: {
        path: '/form/resources/assets'
      },
      on: {
        ...formNextHandler('income-branch'),
      },
    },
    'check-member': {
      '': [
        {
          target: 'income-branch',
          cond: (ctx) => {
            const memberIndex = getCurrentResourceHolderId(ctx.resources);
            const member = getMembers(ctx.household)[memberIndex];

            return !hasJob(member);
          }
        },
        {
          target: 'other-jobs-loop',
          cond: (ctx) => {
            const memberIndex = getCurrentResourceHolderId(ctx.resources);
            const member = getMembers(ctx.household)[memberIndex];

            return hasJob(member) && hasOtherJobs(member);
          }
        }
      ]
    },
    'income-branch': {
      internal: true,
      on: {
        '': [
          {
            target: '#review',
            cond: (ctx) => {
              return !pendingMembersWithResources(ctx.resources);
            },
            actions: 'persist'
          },
          {
            target: 'income',
            cond: (ctx) => {
              return pendingMembersWithResources(ctx.resources);
            },
            actions: [
              'persist'
            ]
          }
        ]
      }
    },
    income: {
      internal: true,
      onEntry: [
        assign({
          currentStep: 'income',
          household: (ctx) => {
            const { household, resources } = ctx;
            const memberIndex = getCurrentResourceHolderId(resources);

            /// set new job index
            return {
              ...updateMemberAtIndex(
                household,
                memberIndex,
                memberJobs.updateCurrentJobForMember(memberIndex, household.members, 0)
              )
            }
          }
        }),
        'persist',
      ],
      onExit: [
        assign({ previousStep: 'income' }),
        'persist'
      ],
      meta: {
        path: '/form/resources/income'
      },
      on: {
        ...formNextHandler('jobs-branch'),
      }
    },
    'jobs-branch': {
      internal: true,
      on: {
        '': [
          {
            target: 'jobs',
            internal: true,
            cond: (context) => {
              /**
               * Determine whether or not the state machine should transition back to the
               * `job` info screen.
               */
              const memberId = getCurrentResourceHolderId(context.resources);
              const member = getMembers(context.household)[memberId];
  
              return member && hasJob(member);
            },
            actions: [
              // set `hasOtherJobs` flag to true if the number of total jobs the user has
              // is greater than the `currentJobIndex` prop
              assign({
                household: (ctx) => {
                  const { household, resources } = ctx;
                  const memberIndex = getCurrentResourceHolderId(resources);
                  const member = getMemberAtIndex(household, memberIndex);

                  if (!member) {
                    return household;
                  }
                  
                  const income = getIncome(member);
                  const jobs = getJobs(member);
                  const nextJobIndex = income.currentJobIndex + 1;

                  const nextMember = {
                    ...member,
                    hasOtherJobs: !jobs.length || jobs.length > nextJobIndex
                  };

                  /// set new job index
                  return updateMemberAtIndex(
                    household,
                    memberIndex,
                    nextMember
                  );
                }
              }),
              'persist'
            ]
          },
          {
            target: 'income-branch',
            internal: true,
            cond: (context) => {
              const memberId = getCurrentResourceHolderId(context.resources);
              const member = getMembers(context.household)[memberId];

              return !member || !hasJob(member);
            },
          }
        ]
      }
    },
    jobs: {
      onEntry: [
        assign((ctx) => {
          
          // TODO: move this logic into a method and import it
          const { household, resources } = ctx
          const memberIndex = getCurrentResourceHolderId(resources);
          const member = getMembers(household)[memberIndex];
          const income = getIncome(member);
          let nextHousehold;

          if (income.jobs[income.currentJobIndex] !== undefined) {
            nextHousehold = household;
          } else {
            const nextMember = {
              ...member,
              hasOtherJobs: member.assetsAndIncome.jobs.length ? false : null,
              assetsAndIncome: {
                ...member.assetsAndIncome,
                jobs: member.assetsAndIncome.jobs.concat([job()]),
                currentJobIndex: member.assetsAndIncome.jobs.length,
              }
            };

            nextHousehold = updateMemberAtIndex(household, memberIndex, nextMember);
          }

          return {
            currentStep: 'jobs',
            // determine if a new job should be to the household member's list of jobs
            household: nextHousehold,
          }
        }),
        'persist',
      ],
      onExit: [
        assign({ previousStep: 'jobs' }),
        'persist'
      ],
      meta: {
        path: '/form/resources/jobs'
      },
      on: {
        ...formNextHandler('other-jobs-loop'),
      }
    },
    'other-jobs-loop': {
      on: {
        '': [
          {
            target: 'jobs-branch',
            cond: (context) => {
              const memberId = getCurrentResourceHolderId(context.resources);
              const member = getMembers(context.household)[memberId];

              return member && hasOtherJobs(member);
            },
            actions: [
              assign({
                household: (ctx) => {
                  const { household, resources } = ctx;
                  const memberIndex = getCurrentResourceHolderId(resources);
      
                  return {
                    ...updateMemberAtIndex(
                      household,
                      memberIndex,
                      memberJobs.incrementJobIndexForMember(memberIndex, household.members)
                    )
                  }
                }
              }),
              'persist'
            ],
          },
          {
            target: 'income-branch',
            cond: (context) => {
              const memberId = getCurrentResourceHolderId(context.resources);
              const member = getMembers(context.household)[memberId];

              return !member || !hasOtherJobs(member);
            },
            actions: [
              assign({
                resources: (ctx) => {
                  return {
                    ...ctx.resources,
                    currentMemberIndex: updateCurrentMemberIndex(ctx.resources, 1)
                  }
                }
              }),
              'persist'
            ]
          },
        ]
      }
    }
  }
};

const submitChart = {
  id: 'submit',
  initial: 'sign-and-submit',
  onEntry: assign({
    currentSection: 'submit',
    currentStep: 'sign-and-submit',
  }),
  states: {
    'sign-and-submit': {
      on: {
        ...formNextHandler('finalize')
      },
      meta: {
        path: '/form/submit/sign-and-submit'
      }
    },
    finalize: {
      invoke: {
        id: 'submitApplication',
        src: (ctx) => {
          let results = {
            registration: {}
          };

          return createRegistration(ctx)
            .then((data) => {
              results.registration = {
                id: data.id,
                createdAt: data.created_date,
                updatedAt: data.modified_date,
              };

              return createEligibility(data.original_data);
            })
            .then((eData) => {
              results.registration = {
                ...results.registration,
                eligible: eData.eligible
              };

              return Promise.resolve(results);
            });
        },
        onDone: {
          target: '#next-steps',
          actions: [
            () => localStorage.clear(),
            assign((ctx, event) => {
              const registration = {
                ...event.data.registration,
                applicantName: getFullName(getApplicant(ctx.household))
              };
              const nextState = {
                ...defaultAppState,
                errors: { server: false },
                registration
              };

              return nextState;
            }),
          ]
        },
        onError: {
          target: 'sign-and-submit',
          actions: [
            assign({
              errors: () => ({
                server: true
              })
            })
          ]
        }
      },
    },
  }
};

const preRegistrationChart = {
  id: 'pre-registration',
  internal: true,
  initial: 'loading',
  strict: true,
  onEntry: [ 'persist' ],
  onExit: [
    assign({ previousSection: 'pre-registration' }),
    'persist',
  ],
  states: {
    loading: {
      onEntry: assign({ meta: (context) => ({
        ...context.meta,
        loading: true
      })}),
      invoke: {
        id: 'getDisasters',
        src: () => getDisasters(),
        onError: {
          target: 'set-up',
          actions: [
            assign({
              errors: () => ({
                server: true
              }),
              meta: (context) => ({
                ...context.meta,
                loading: false
              }),
              disasters: disaster(),
            })
          ]
        },
        onDone: {
          target: 'set-up',
          actions: [
            assign({
              errors: () => ({ server: false }),
              disasters: (_, event) => {
                return {
                  data: event.data.reduce((memo, disaster) => {
                    return {
                      ...memo,
                      [disaster.id]: disaster
                    }
                  }, {})
                };
              },
              meta: (context) => ({
                ...context.meta,
                loading: false
              })
            })
          ]
        },
      }
    },
    'set-up': {
      onEntry:
        assign({
          currentSection: 'pre-registration',
          currentStep: ''
        }),
      meta: {
        path: '/form/pre-registration'
      },
      on: {
        ...formNextHandler('#get-prepared')
      } 
    }
  },
};

const reviewChart = {
  id: 'review',
  initial: 'default',
  strict: true,
  onEntry: [
    assign({
      currentSection: 'review',
      currentStep: 'review',
      step: 6,
    }),
    'persist'
  ],
  onExit: assign({
    previousSection: 'review',
    previousStep: 'review'
  }),
  on: {
    'RESET_CURRENT_RESOURCE_MEMBER_INDEX': {
      target: '#resources',
    }
  },
  states: {
    default: {
      meta: {
        path: '/form/review'
      },
      on: {
        ...formNextHandler('#submit'),
        EDIT: 'edit'
      }
    },
    edit: {
      internal: true,
      onEntry: [
        'persist',
        assign((_, event) => {
          const { type, ...rest } = event;

          return {
            ...rest
          };
        })
      ],
      on: {
        ...formNextHandler('#submit'),
      }
    },
  }
};

const welcomeChart = {
  id: 'welcome',
  strict: true,
  initial: 'welcome',
  states: {
    welcome: {
      onEntry: [
        assign({
          currentSection: 'welcome',
          currentStep: ''
        }),
        'persist',
      ],
      onExit: [
        assign({ previousSection: 'welcome' }),
        'persist'
      ],
      meta: {
        path: '/welcome'
      },
      on: {
        ...formNextHandler('#form')
      }
    }
  }
};

const formStateConfig = {
  id: 'form',
  strict: true,
  internal: true,
  initial: 'pre-registration',
  onEntry: [
    assign({ prefix: 'form' }),
  ],
  onExit: assign({ prefix: '' }),
  states: {
    'pre-registration': preRegistrationChart,
    'get-prepared': {
      id: 'get-prepared',
      internal: true,
      strict: true,
      onEntry: assign({ currentSection: 'get-prepared', currentStep: '' }),
      onExit: assign({ previousSection: 'get-prepared', previousStep: '' }),
      meta: {
        path: '/form/get-prepared'
      },
      on: {
        ...formNextHandler('#basic-info')
      }
    },
    'basic-info': basicInfoChart,
    identity: identityChart,
    household: householdChart,
    impact: impactChart,
    resources: resourcesChart,
    review: reviewChart,
    submit: submitChart,
    'next-steps': {
      id: 'next-steps',
      initial: 'eligibility',
      states: {
        eligibility: {
          on: {
            '': [
              {
                target: 'eligible',
                cond: (context) => {
                  return context.registration.eligible;
                }
              },
              {
                target: 'ineligible',
                cond: (context) => {
                  return !context.registration.eligible;
                }
              }
            ]
          }
        },
        eligible: {
          onEntry: assign({currentStep: 'eligible'}),
          meta: {
            path: '/form/next-steps/eligible'
          }
        },
        ineligible: {
          onEntry: assign({ currentStep: 'ineligible' }),
          meta: {
            path: '/form/next-steps/ineligible',
          }
        }
      }
    },
    finish: {},
    quit: {
      invoke: {
        id: 'clearSessionState',
        src: () =>
          new Promise((resolve) => {
            localStorage.removeItem(STATE_KEY);
            return resolve(defaultAppState)
          }),
        onDone: {
          target: '#welcome',
          internal: true,
          actions: [
            assign((_, event) => {
              return { ...event.data }
            })
          ]
        },
      }
    },
  },
  on: {
    QUIT: {
      target: '.quit',
    },
    RESET: {
      target: '#welcome'
    }
  }
};

const appChart = {
  initial: 'idle',
  strict: true,
  states: {
    idle: {},
    welcome: welcomeChart,
    form: formStateConfig,
  }
};

const extraActions = {
  persist: (context, {type, ...data}) => {
    const shouldStoreState = context.config.useLocalStorage;

    if (shouldStoreState !== null && !isAffirmative(shouldStoreState)) {
      return;
    }

    const nextState = (() => {
      // we are transitioning through a null state, which doesn't provide
      // data to the state machine. so, write the current context to local storage
      if (!type) {
        return context;
      }

      const overwrites = Object.entries(data)
        .filter(([name, _]) => ignoreKeys.indexOf(name) === -1)
        .reduce((memo, [name, nextData]) => {
          const existingContextSlice = context[name];
          const formattedContextSlice = isPrimitive(existingContextSlice) ?
            nextData : { ...context[name], ...nextData };

          return {
            ...memo,
            [name]: formattedContextSlice,
          }
        }, {});

      return {
        ...context,
        ...overwrites
      };
    })();

    localStorage.setItem(STATE_KEY, JSON.stringify(nextState));
  }
};

export default {
  config: appChart,
  actions: extraActions,
  services: {},
  initialState: initialState(),
};
