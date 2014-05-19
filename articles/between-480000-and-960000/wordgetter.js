function createWordgetter() {
  var settings = {
    randomWordsBaseURL: 'http://api.wordnik.com/v4/words.json/' +
      'randomWords?hasDictionaryDef=false&' +
      'excludePartOfSpeech=proper-noun&minCorpusCount=0&maxCorpusCount=-1&' +
      'minDictionaryCount=1&maxDictionaryCount=-1&minLength=7&maxLength=7&' +
      'api_key=4127d30929863bfd6f00b0bf4f805a04980240ddbe2fa0a1d',
    fallbackObjects: [
      'sweatpants',
      'corn syrup',
      'toilet paper',
      'pipewrench',
      'karate manual',
      'hand sanitizer',
      'sandwich',
      'car battery',
      'grappling hook',
      'harmonica',
      'interior flat paint',
      'milk',
      'mayonnaise'
    ],
    buzzkills: [
      'Negro',
      'Negroes',
      'chink',
      'chinks',
      'gook',
      'gooks',
      'nigger',
      'niggers',
      'spic',
      'spics',
      'rape',
      'rapes',
      'rapist',
      'rapists'
    ]
  };

  var requester = createRequestMaker();

  function getWords(number, done) {
    var items = []; 

    requester.makeRequest({
      method: 'GET',
      url: settings.randomWordsBaseURL + '&limit=' + number,
      timeLimit: 2500, 
      done: requestDone
    });

    function requestDone(error, wordObjects) {
      var words = [];
      if (error) {
        console.log(error);
        for (var i = 0; i < number; ++i) {
          words.push(pickFromArrayAtRandom(settings.fallbackObjects));    
        }
      }
      else {
        words = wordObjects.map(getWordFromObject);
      }
      done(null, words);
    }
  }

  function getWordFromObject(obj) {
    var word = null;
    if (settings.buzzkills.indexOf(obj.word) === -1) {
      word = obj.word;
    }
    else {
      word = pickFromArrayAtRandom(settings.fallbackObjects);
    }
    return word;
  }

  function pickFromArrayAtRandom(array) {
    return array[~~(Math.random() * array.length)];
  }

  return {
    getWords: getWords
  };
}
