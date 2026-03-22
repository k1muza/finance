-- ============================================================
-- SONGS — Seed Data
-- Run this AFTER schema_songs.sql in the Supabase SQL Editor
-- ============================================================

INSERT INTO songs (id, title, author, song_key, sort_order, published, lyrics) VALUES

-- 1. Great Is Thy Faithfulness
(
  'b0000000-0000-0000-0000-000000000001',
  'Great Is Thy Faithfulness',
  'Thomas O. Chisholm',
  'G',
  1,
  true,
  '[Verse 1]
Great is Thy faithfulness, O God my Father
There is no shadow of turning with Thee
Thou changest not, Thy compassions they fail not
As Thou hast been, Thou forever wilt be

[Chorus]
Great is Thy faithfulness
Great is Thy faithfulness
Morning by morning new mercies I see
All I have needed Thy hand hath provided
Great is Thy faithfulness, Lord unto me

[Verse 2]
Summer and winter and springtime and harvest
Sun, moon and stars in their courses above
Join with all nature in manifold witness
To Thy great faithfulness, mercy and love

[Chorus]

[Verse 3]
Pardon for sin and a peace that endureth
Thine own dear presence to cheer and to guide
Strength for today and bright hope for tomorrow
Blessings all mine with ten thousand beside

[Chorus]'
),

-- 2. How Great Thou Art
(
  'b0000000-0000-0000-0000-000000000002',
  'How Great Thou Art',
  'Stuart K. Hine',
  'Bb',
  2,
  true,
  '[Verse 1]
O Lord my God, when I in awesome wonder
Consider all the worlds Thy hands have made
I see the stars, I hear the rolling thunder
Thy power throughout the universe displayed

[Chorus]
Then sings my soul, my Saviour God to Thee
How great Thou art, how great Thou art
Then sings my soul, my Saviour God to Thee
How great Thou art, how great Thou art

[Verse 2]
When through the woods and forest glades I wander
And hear the birds sing sweetly in the trees
When I look down from lofty mountain grandeur
And hear the brook and feel the gentle breeze

[Chorus]

[Verse 3]
And when I think that God, His Son not sparing
Sent Him to die, I scarce can take it in
That on the cross, my burden gladly bearing
He bled and died to take away my sin

[Chorus]

[Verse 4]
When Christ shall come with shout of acclamation
And take me home, what joy shall fill my heart
Then I shall bow in humble adoration
And there proclaim, my God, how great Thou art

[Chorus]'
),

-- 3. Blessed Assurance
(
  'b0000000-0000-0000-0000-000000000003',
  'Blessed Assurance',
  'Fanny J. Crosby',
  'D',
  3,
  true,
  '[Verse 1]
Blessed assurance, Jesus is mine
O what a foretaste of glory divine
Heir of salvation, purchase of God
Born of His Spirit, washed in His blood

[Chorus]
This is my story, this is my song
Praising my Saviour all the day long
This is my story, this is my song
Praising my Saviour all the day long

[Verse 2]
Perfect submission, perfect delight
Visions of rapture now burst on my sight
Angels descending, bring from above
Echoes of mercy, whispers of love

[Chorus]

[Verse 3]
Perfect submission, all is at rest
I in my Saviour am happy and blest
Watching and waiting, looking above
Filled with His goodness, lost in His love

[Chorus]'
),

-- 4. Amazing Grace
(
  'b0000000-0000-0000-0000-000000000004',
  'Amazing Grace',
  'John Newton',
  'G',
  4,
  true,
  '[Verse 1]
Amazing grace, how sweet the sound
That saved a wretch like me
I once was lost, but now am found
Was blind, but now I see

[Verse 2]
''Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed

[Verse 3]
Through many dangers, toils and snares
I have already come
''Tis grace hath brought me safe thus far
And grace will lead me home

[Verse 4]
The Lord has promised good to me
His word my hope secures
He will my shield and portion be
As long as life endures

[Verse 5]
When we''ve been there ten thousand years
Bright shining as the sun
We''ve no less days to sing God''s praise
Than when we''d first begun'
),

-- 5. What A Friend We Have In Jesus
(
  'b0000000-0000-0000-0000-000000000005',
  'What A Friend We Have In Jesus',
  'Joseph M. Scriven',
  'F',
  5,
  true,
  '[Verse 1]
What a friend we have in Jesus
All our sins and griefs to bear
What a privilege to carry
Everything to God in prayer
O what peace we often forfeit
O what needless pain we bear
All because we do not carry
Everything to God in prayer

[Verse 2]
Have we trials and temptations
Is there trouble anywhere
We should never be discouraged
Take it to the Lord in prayer
Can we find a friend so faithful
Who will all our sorrows share
Jesus knows our every weakness
Take it to the Lord in prayer

[Verse 3]
Are we weak and heavy laden
Cumbered with a load of care
Precious Saviour still our refuge
Take it to the Lord in prayer
Do thy friends despise, forsake thee
Take it to the Lord in prayer
In His arms He''ll take and shield thee
Thou wilt find a solace there'
),

-- 6. To God Be The Glory
(
  'b0000000-0000-0000-0000-000000000006',
  'To God Be The Glory',
  'Fanny J. Crosby',
  'Eb',
  6,
  true,
  '[Verse 1]
To God be the glory, great things He hath taught us
Great things He hath done and great our rejoicing
Through Jesus the Son, but purer and higher
And greater our wonder, His glory the theme

[Chorus]
Praise the Lord, praise the Lord
Let the earth hear His voice
Praise the Lord, praise the Lord
Let the people rejoice
O come to the Father through Jesus the Son
And give Him the glory, great things He hath done

[Verse 2]
O perfect redemption, the purchase of bloodshed
To every believer the promise of God
The vilest offender who truly believes
That moment from Jesus a pardon receives

[Chorus]

[Verse 3]
Great things He hath taught us, great things He hath done
And great our rejoicing through Jesus the Son
But purer and higher and greater will be
Our wonder, our transport, when Jesus we see

[Chorus]'
),

-- 7. All Hail The Power Of Jesus Name
(
  'b0000000-0000-0000-0000-000000000007',
  'All Hail The Power Of Jesus'' Name',
  'Edward Perronet',
  'D',
  7,
  true,
  '[Verse 1]
All hail the power of Jesus'' name
Let angels prostrate fall
Bring forth the royal diadem
And crown Him Lord of all
Bring forth the royal diadem
And crown Him Lord of all

[Verse 2]
Ye chosen seed of Israel''s race
Ye ransomed from the fall
Hail Him who saves you by His grace
And crown Him Lord of all
Hail Him who saves you by His grace
And crown Him Lord of all

[Verse 3]
Let every kindred, every tribe
On this terrestrial ball
To Him all majesty ascribe
And crown Him Lord of all
To Him all majesty ascribe
And crown Him Lord of all

[Verse 4]
O that with yonder sacred throng
We at His feet may fall
We''ll join the everlasting song
And crown Him Lord of all
We''ll join the everlasting song
And crown Him Lord of all'
);
