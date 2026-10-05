import { analyze } from './pitch.js';
import { contour } from './phrase-contour.js';

self.onmessage = ({ data: { id, operation, samples, rate, tone } }) => {
  try {
    const result = operation === 'syllable' ? analyze(samples, rate, tone) : contour(samples, rate);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
