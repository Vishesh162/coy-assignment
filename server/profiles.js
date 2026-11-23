// Fictional adults. Photographs are placeholder portraits, not identity claims.
const people = [
  ['Aanya', 23, 'Bengaluru', 'Christ University', 'Usually finding a new cafe, a good book, or an excuse to take the scenic route.', ['Coffee', 'Books', 'Travel'], 'women/44'],
  ['Kabir', 25, 'Mumbai', 'IIT Bombay', 'Weekend hikes, questionable playlists, and very strong opinions about street food.', ['Hiking', 'Music', 'Food'], 'men/32'],
  ['Meera', 22, 'Delhi', 'Delhi University', 'Design student. I notice the little things and photograph most of them.', ['Design', 'Photography', 'Art'], 'women/68'],
  ['Arjun', 24, 'Pune', 'COEP', 'A cricket match and a homemade meal is my kind of Sunday.', ['Cricket', 'Cooking', 'Movies'], 'men/46'],
  ['Tara', 24, 'Bengaluru', 'NIFT', 'Thrift finds, film photos, and conversations that outlast the coffee.', ['Fashion', 'Photography', 'Coffee'], 'women/49'],
  ['Ishaan', 26, 'Hyderabad', 'IIIT Hyderabad', 'Building things during the week. Looking for a trail to get lost on at weekends.', ['Tech', 'Hiking', 'Gaming'], 'men/75'],
  ['Rhea', 23, 'Mumbai', 'St. Xavier’s College', 'Live music person. Will happily introduce you to your next favourite band.', ['Music', 'Concerts', 'Travel'], 'women/65'],
  ['Dev', 24, 'Chennai', 'IIT Madras', 'I make excellent filter coffee and mediocre pottery. Both are improving.', ['Coffee', 'Pottery', 'Cycling'], 'men/54'],
  ['Naina', 25, 'Pune', 'Symbiosis', 'My camera roll is mostly dogs, sunsets, and food I forgot to review.', ['Dogs', 'Travel', 'Food'], 'women/47'],
  ['Rohan', 23, 'Delhi', 'DTU', 'Football on Saturdays, bookstores on Sundays. Always up for a new board game.', ['Football', 'Books', 'Board games'], 'men/11'],
  ['Zoya', 24, 'Hyderabad', 'University of Hyderabad', 'Learning the guitar one patient neighbour at a time.', ['Music', 'Art', 'Cooking'], 'women/63'],
  ['Neel', 26, 'Bengaluru', 'PES University', 'Early runs, late films, and a growing collection of plants.', ['Running', 'Movies', 'Plants'], 'men/33'],
  ['Sana', 22, 'Chennai', 'Loyola College', 'A beach walk is a perfectly good plan. Dessert afterwards makes it better.', ['Beach', 'Baking', 'Books'], 'women/21'],
  ['Vihaan', 25, 'Mumbai', 'Mumbai University', 'Trying one new recipe each week. The smoke alarm has only complained twice.', ['Cooking', 'Fitness', 'Travel'], 'men/22'],
  ['Kavya', 24, 'Delhi', 'Jamia Millia Islamia', 'A writer with a notebook in every bag and a new museum on the list.', ['Writing', 'Museums', 'Coffee'], 'women/26'],
  ['Aditya', 23, 'Pune', 'SPPU', 'Badminton, podcasts, and finding the best breakfast in town.', ['Badminton', 'Podcasts', 'Food'], 'men/34'],
  ['Anika', 26, 'Bengaluru', 'IISc', 'Science by day, salsa by night. Happy to teach you the basic step.', ['Dance', 'Science', 'Travel'], 'women/28'],
  ['Yash', 24, 'Hyderabad', 'BITS Pilani', 'My perfect evening: a long walk and a film neither of us has seen.', ['Movies', 'Walking', 'Tech'], 'men/36'],
  ['Diya', 23, 'Mumbai', 'Jai Hind College', 'I collect postcards and try to visit the places on them.', ['Travel', 'Art', 'Books'], 'women/31'],
  ['Aarav', 25, 'Chennai', 'Anna University', 'Basketball after work. Learning to bake something other than banana bread.', ['Basketball', 'Baking', 'Music'], 'men/38'],
  ['Leela', 24, 'Delhi', 'Ashoka University', 'A good conversation, a quiet garden, and enough time to enjoy both.', ['Plants', 'Poetry', 'Yoga'], 'women/32'],
  ['Sahil', 26, 'Pune', 'FLAME University', 'Finding hidden food spots is a hobby. Sharing them is the fun part.', ['Food', 'Photography', 'Cycling'], 'men/40'],
  ['Avni', 22, 'Bengaluru', 'Mount Carmel College', 'Dance classes, indie films, and the occasional impulse train journey.', ['Dance', 'Movies', 'Travel'], 'women/33'],
  ['Dhruv', 24, 'Mumbai', 'NMIMS', 'The friend who organises game night and remembers everyone’s favourite snacks.', ['Board games', 'Cooking', 'Cricket'], 'men/41'],
  ['Mahi', 25, 'Hyderabad', 'Osmania University', 'Making tiny ceramic cups and big plans for the next road trip.', ['Pottery', 'Road trips', 'Art'], 'women/35'],
  ['Kunal', 23, 'Delhi', 'NSUT', 'Curious about everything. Particularly your favourite book.', ['Books', 'Tech', 'Hiking'], 'men/42'],
  ['Siya', 24, 'Chennai', 'Stella Maris College', 'The ocean, a sketchbook, and a playlist with far too many songs.', ['Art', 'Beach', 'Music'], 'women/36'],
  ['Manav', 26, 'Pune', 'MIT-WPU', 'A cyclist who stops for every interesting bakery.', ['Cycling', 'Coffee', 'Travel'], 'men/43'],
  ['Alia', 23, 'Mumbai', 'Sophia College', 'A film buff who will watch the credits with you.', ['Movies', 'Writing', 'Coffee'], 'women/37'],
  ['Reyansh', 25, 'Bengaluru', 'RV College', 'Volunteering on weekends and slowly training for my first half marathon.', ['Running', 'Volunteering', 'Dogs'], 'men/45'],
  ['Myra', 24, 'Delhi', 'Miranda House', 'Good food and terrible puns. Ideally in the same conversation.', ['Food', 'Comedy', 'Books'], 'women/38'],
  ['Ved', 23, 'Hyderabad', 'JNTU', 'Chess at the park, music on the way home. I like taking my time.', ['Chess', 'Music', 'Walking'], 'men/48'],
];

export const profiles = people.map(([name, age, city, college, bio, interests, portrait], index) => ({
  id: `p${String(index + 1).padStart(2, '0')}`,
  name, age, city, college, bio, interests,
  photo: `/portraits/${portrait.replace('/', '-')}.jpg`,
}));

// Incoming likes live only on the server. Never serialize this set into a response.
export const incomingLikes = new Set(['p01', 'p04', 'p07', 'p09', 'p12', 'p17', 'p21', 'p26', 'p30']);

// An explicit DTO allowlist prevents future private fields leaking into API responses.
export function publicProfile(profile) {
  return {
    id: profile.id, name: profile.name, age: profile.age, photo: profile.photo,
    bio: profile.bio, city: profile.city, college: profile.college,
    interests: [...profile.interests],
  };
}
