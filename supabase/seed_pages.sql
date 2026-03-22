-- ============================================================
-- PAGES — Seed Data
-- Run this AFTER schema_pages.sql in the Supabase SQL Editor
-- ============================================================

INSERT INTO pages (id, title, slug, icon_class, sort_order, published, content) VALUES

-- ─────────────────────────────────────────
-- 1. About ZAOGA FIF
-- ─────────────────────────────────────────
(
  'a0000000-0000-0000-0000-000000000001',
  'About ZAOGA FIF',
  'about-zaoga-fif',
  'mdi mdi-church',
  1,
  true,
  '<h2>Zimbabwe Assemblies of God Africa — Forward in Faith</h2>
<p>ZAOGA Forward in Faith (ZAOGA FIF) is one of Africa''s largest and fastest-growing Pentecostal movements, founded in Zimbabwe in 1960 by Archbishop Ezekiel H. Guti. What began as a small prayer meeting has grown into a global fellowship spanning more than 100 nations across every continent.</p>
<h3>Our Mission</h3>
<p>ZAOGA FIF exists to fulfil the Great Commission — to go into all the world and preach the Gospel of Jesus Christ, making disciples of all nations. We are committed to winning souls, planting churches, and raising leaders who transform communities through the power of the Holy Spirit.</p>
<h3>Our Vision</h3>
<p>To be a Spirit-filled, Word-based movement that demonstrates the love of God and the power of the Gospel in every nation, tribe, and tongue. We believe in the full gospel — salvation, healing, deliverance, and the baptism of the Holy Spirit.</p>
<h3>Core Values</h3>
<ul>
<li><strong>Scripture</strong> — The Bible is the inspired, authoritative Word of God and the foundation for all we do.</li>
<li><strong>Prayer</strong> — Intercession is the engine of our ministry. We are a praying church.</li>
<li><strong>Discipleship</strong> — We are committed to the growth and development of every believer.</li>
<li><strong>Unity</strong> — We celebrate our diversity and stand together as one body in Christ.</li>
<li><strong>Excellence</strong> — We serve God and His people with our very best.</li>
</ul>
<p>Today, ZAOGA FIF continues to advance the Kingdom of God through evangelism, church planting, Bible schools, and community transformation — all under the banner of <em>Forward in Faith</em>.</p>'
),

-- ─────────────────────────────────────────
-- 2. About Pastor Douglas and Eugenie Machinge
-- ─────────────────────────────────────────
(
  'a0000000-0000-0000-0000-000000000002',
  'About Pastor Douglas and Eugenie Machinge',
  'about-pastor-douglas-and-eugenie-machinge',
  'mdi mdi-account-heart',
  2,
  true,
  '<h2>Pastor Douglas &amp; Eugenie Machinge</h2>
<p>Pastor Douglas Machinge and his wife Eugenie are anointed servants of God whose lives are a testimony of faith, perseverance, and unwavering dedication to the call of God. Together they lead with a shared vision — to see the Body of Christ built up, empowered, and mobilised for Kingdom impact.</p>
<h3>Pastor Douglas Machinge</h3>
<p>Pastor Douglas has dedicated his life to the ministry of the Gospel, serving in ZAOGA Forward in Faith for many years. He carries a deep passion for discipleship, sound doctrine, and the advancement of the local church. His preaching is marked by clarity, conviction, and the demonstration of the Holy Spirit''s power.</p>
<p>Pastor Douglas has served in various capacities within the ZAOGA movement, planting and nurturing congregations and mentoring a generation of young leaders who are making a difference across the nations.</p>
<h3>Pastor Eugenie Machinge</h3>
<p>Mama Eugenie, as she is affectionately known, is a pillar of strength and grace in the ministry. Her heart for women, families, and the next generation has made a profound impact in the lives of countless people. She leads with compassion, wisdom, and a servant''s heart, and her ministry extends into every area of the local church and beyond.</p>
<h3>Together in Ministry</h3>
<p>As a ministry couple, Pastor Douglas and Eugenie model the beauty of partnership in the Gospel. Their home is open, their lives are transparent, and their commitment to the local church is unwavering. They serve together under the authority and blessing of the ZAOGA FIF movement, believing God for greater things ahead.</p>
<blockquote><p><em>"We exist to serve God''s people and to see every believer walk in the fullness of their God-given destiny."</em></p></blockquote>'
),

-- ─────────────────────────────────────────
-- 3. About Southgate Christian Center International District
-- ─────────────────────────────────────────
(
  'a0000000-0000-0000-0000-000000000003',
  'About Southgate Christian Center International District',
  'about-southgate-christian-center-international-district',
  'mdi mdi-map-marker-radius',
  3,
  true,
  '<h2>Southgate Christian Center International District</h2>
<p>The Southgate Christian Center International District is a vibrant and growing district of ZAOGA Forward in Faith, committed to reaching communities, planting churches, and raising disciples who carry the Gospel with boldness and love.</p>
<h3>Who We Are</h3>
<p>We are a family of believers united by our faith in Jesus Christ and our commitment to the ZAOGA FIF vision. Our district is home to multiple local assemblies, each one a lighthouse in its community — shining the light of Christ and demonstrating the Kingdom of God in practical, transformative ways.</p>
<h3>Our District Vision</h3>
<p>We believe in building strong local churches that are centres of evangelism, discipleship, worship, and community service. Every church in our district is purposed to be a place where the lost are found, the broken are healed, and believers are equipped to serve.</p>
<h3>District Ministries</h3>
<ul>
<li><strong>Evangelism &amp; Outreach</strong> — Regular crusades, open-air meetings, and community outreach programmes.</li>
<li><strong>Bible School</strong> — Training and equipping ministers and lay leaders with the Word of God.</li>
<li><strong>Women''s Ministry</strong> — Empowering women to fulfil their calling in the home, church, and society.</li>
<li><strong>Youth &amp; Children</strong> — Raising the next generation in the fear and knowledge of God.</li>
<li><strong>Community Development</strong> — Serving the practical needs of our communities in the name of Jesus.</li>
</ul>
<h3>Our Heart</h3>
<p>As a district, we are deeply committed to the ZAOGA FIF movement and the global vision of Archbishop Ezekiel Guti. We press forward together — in unity, in faith, and in love — believing God for a great harvest in our generation.</p>'
),

-- ─────────────────────────────────────────
-- 4. About Youth Leadership
-- ─────────────────────────────────────────
(
  'a0000000-0000-0000-0000-000000000004',
  'About Youth Leadership',
  'about-youth-leadership',
  'mdi mdi-account-group',
  4,
  true,
  '<h2>Youth Leadership</h2>
<p>The Youth Leadership of ZAOGA Forward in Faith in the Southgate Christian Center International District represents the future of the movement — a generation rising in faith, character, and purpose. We believe that young people are not just the church of tomorrow; they are the church of today.</p>
<h3>Our Purpose</h3>
<p>Youth Leadership exists to disciple, develop, and deploy young people into every sphere of life as ambassadors of the Kingdom of God. We are committed to raising a generation that is rooted in the Word, filled with the Spirit, and passionate about making a difference in the world.</p>
<h3>What We Do</h3>
<ul>
<li><strong>Discipleship</strong> — Weekly Bible studies, mentorship programmes, and spiritual formation for young believers.</li>
<li><strong>Leadership Development</strong> — Practical training in ministry, administration, and servant leadership.</li>
<li><strong>Evangelism</strong> — Campus outreach, community missions, and youth-led crusades that bring the Gospel to the streets.</li>
<li><strong>Worship</strong> — A dynamic worship culture that ushers young people into the presence of God.</li>
<li><strong>Fellowship</strong> — Building authentic community and lifelong friendships grounded in Christ.</li>
</ul>
<h3>Our Values</h3>
<p>We are a generation that honours God, respects authority, and serves one another in love. We reject compromise and embrace a standard of holiness that reflects the character of Christ. We are bold, we are hungry, and we are moving forward.</p>
<h3>Get Involved</h3>
<p>Every young person is welcome. Whether you are new to faith or have grown up in the church, there is a place for you here. Come as you are — and be transformed by the grace of God.</p>
<blockquote><p><em>"Let no one despise you for your youth, but set the believers an example in speech, in conduct, in love, in faith, in purity." — 1 Timothy 4:12</em></p></blockquote>'
);
