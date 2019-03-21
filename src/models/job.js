const initialState = {
  employerName: '',
  pay: '',
  isDsnapAgency: null
};

const job = (state = initialState) => ({
  employerName: state.employerName,
  pay: state.pay,
  isDsnapAgency: state.isDsnapAgency,
});

export const isGovernmentAgency = job => job.isDsnapAgency;

export default job;
