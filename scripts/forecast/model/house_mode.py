"""TPSI House Mode: Florida and Texas, on the maps enacted for 2026.

Same structure as the Florida first build, now with two states and with projected vote totals for every district.
  spine    each district's 2024 presidential two party share on the enacted lines
  M1       state county Trump approval, calibrated as in Senate Mode, converted to vote with the TPSI respondent crosstab
  M2       the state's certified 2024 result moved by the TPSI demographic swing to the Gallup anchored 2026 environment
  M3       the state's 2024 level moved by the national swing from 2024 to the 2026 generic ballot, district polls where they exist
  blend    equal thirds, giving one statewide House level
  spread   district lean plus a candidate term, with one constant so the turnout weighted statewide share matches the blend
  votes    state projected House turnout from the Senate Mode midterm anchor, split by district turnout share
  sims     10,000 draws with a correlated statewide error and an independent district error
"""
import json, os, numpy as np, pandas as pd, sys
sys.path.insert(0, "..")
import senate_mode as sm

logit, inv = sm.logit, sm.inv
OUT = os.environ.get("OUT_HOUSE", "../output_house")
os.makedirs(OUT, exist_ok=True)

# columns: district, Trump margin on the enacted lines, party of an incumbent running here, Republican, Democrat, third, third party, note
FL = [
    (1, 38.98, 'R', 'Jimmy Patronis', 'Gay Valimont', 'Tyler Davis', 'NPA', 'Patronis seeking a full term'),
    (2, 18.07, '', 'Austin Rogers', 'Amanda Marie Green', '', '', 'Open seat, Dunn retiring'),
    (3, 20.99, 'R', 'Kat Cammack', 'Seth Harp', 'Anthony Stebbins', 'L', 'Cammack seeking a fourth term'),
    (4, 11.8, 'R', 'Aaron Bean', 'LaShonda Holloway', 'Todd Schaefer', 'NPA', 'Bean seeking a third term'),
    (5, 21.34, 'R', 'John Rutherford', 'Rachel Grage', '', '', 'Rutherford seeking a sixth term'),
    (6, 29.99, 'R', 'Randy Fine', 'Eric Yonce', '', '', 'Fine seeking a full term'),
    (7, 12.42, '', 'Ryan Elijah', 'Bale Dalton', 'Christopher Dennison', 'L', 'Open in effect, Mills lost the primary'),
    (8, 16.14, 'R', 'Mike Haridopolos', 'Jennifer Jenkins', '', '', 'Haridopolos seeking a second term'),
    (9, 17.71, 'D', 'Dan Green', 'Darren Soto', '', '', 'Soto redrawn into a Trump district'),
    (10, -23.89, 'D', 'No Republican on the ballot', 'Maxwell Frost', '', '', 'No Republican qualified for the ballot, Frost is unopposed'),
    (11, 15.63, '', 'Joe Strada', 'James Pericola', 'Ralph Groves', 'L', 'Open seat, Webster retiring'),
    (12, 15.33, 'R', 'Gus Bilirakis', 'Kimberly Overman', 'Branden Scrivener', 'NPA', 'Bilirakis seeking an eleventh term'),
    (13, 13.26, 'R', 'Anna Paulina Luna', 'Leela Gray', '', '', 'Luna seeking a third term'),
    (14, 10.47, 'D', 'Mike Beltran', 'Kathy Castor', '', '', 'Castor redrawn into a Trump district'),
    (15, 19.77, 'R', 'Laurel Lee', 'Robert People', '', '', 'Lee seeking a third term'),
    (16, 13.64, '', 'Sydney Gruters', 'Kelly Kirschner', '', '', 'Open seat, Buchanan off the ballot'),
    (17, 22.0, 'R', 'Greg Steube', 'Matthew Montavon', '', '', 'Steube seeking a fifth term'),
    (18, 16.9, 'R', 'Scott Franklin', 'Curtis Gibson', 'Deva Simmons', 'NPA', 'Franklin seeking a fourth term'),
    (19, 30.08, '', 'Jim Schwartzel', 'Victor Arias', '', '', 'Open seat, Donalds running for governor'),
    (20, -37.06, '', 'Brent Andersen', 'Debbie Wasserman Schultz', 'Kedner Maxime', 'I', 'Open seat, Cherfilus-McCormick resigned in April, Wasserman Schultz moved here from the 25th'),
    (21, 16.17, 'R', 'Brian Mast', 'James Martin', 'Alexander Cooke', 'I', 'Mast seeking a sixth term'),
    (22, 10.47, '', 'Casey Askar', 'Pia Dandiya', '', '', 'Open seat on the new lines'),
    (23, -13.77, '', 'Deborah Adeimy', 'Lois Frankel', '', '', 'Open seat on the new lines'),
    (24, -38.62, '', 'Te Mayonna Brown', 'Oliver Gilbert III', '', '', 'Open seat, Wilson retiring'),
    (25, 9.11, 'D', 'Scott Singer', 'Jared Moskowitz', '', '', 'Moskowitz in a Trump leaning seat'),
    (26, 18.32, 'R', 'Mario Diaz-Balart', 'Nicole Locklin', 'Deborah Ann Meidinger Hosey', 'I', 'Diaz-Balart seeking an eleventh term'),
    (27, 14.53, 'R', 'Maria Elvira Salazar', 'Elliott Rodriguez', '', '', 'Salazar seeking a third term'),
    (28, 25.39, 'R', 'Carlos Gimenez', 'Phil Ehr', 'Eddy Rojas', 'I', 'Gimenez seeking a third term'),
]
TX = [
    (1, 49.46, 'R', 'Nathaniel Moran', 'Yolanda Prince', 'Sonia Canchola', 'I', 'Moran seeking a third term'),
    (2, 22.83, '', 'Steve Toth', 'Shaun Finnie', '', '', 'Open in effect, Crenshaw lost the primary'),
    (3, 23.34, 'R', 'Keith Self', 'Evan Hunt', '', '', 'Self seeking a third term'),
    (4, 24.63, 'R', 'Pat Fallon', 'Jason Pearce', '', '', 'Fallon seeking a fourth term'),
    (5, 21.55, 'R', 'Lance Gooden', 'Chelsey Hockett', '', '', 'Gooden seeking a fifth term'),
    (6, 22.87, 'R', 'Jake Ellzey', 'Danny Minton', '', '', 'Ellzey seeking a third full term'),
    (7, -23.42, 'D', 'Alexander Hale', 'Lizzie Fletcher', 'Ngabo Espoir', 'G', 'Fletcher seeking a fifth term'),
    (8, 27.63, '', 'Jessica Steinmann', 'Laura Jones', '', '', 'Open seat, Luttrell retiring'),
    (9, 19.88, '', 'Alex Mealer', 'Leticia Gutierrez', '', '', 'Redrawn from D+44 to R+20, Al Green moved to the 18th'),
    (10, 22.56, '', 'Chris Gober', 'Caitlin Rourk', '', '', 'Open seat, McCaul retiring'),
    (11, 34.3, 'R', 'August Pfluger', 'Claire Reynolds', '', '', 'Pfluger seeking a fourth term'),
    (12, 23.87, 'R', 'Craig Goldman', 'Heli Rodriguez Prilliman', '', '', 'Goldman seeking a second term'),
    (13, 46.16, 'R', 'Ronny Jackson', 'Mark Nair', '', '', 'Jackson seeking a fourth term'),
    (14, 24.27, 'R', 'Randy Weber', 'Thurman Bill Bartie', '', '', 'Weber seeking an eighth term'),
    (15, 17.86, 'R', 'Monica De La Cruz', 'Bobby Pulido', '', '', 'De La Cruz seeking a third term'),
    (16, -16.38, 'D', 'Adam Bauman', 'Veronica Escobar', '', '', 'Escobar seeking a fifth term'),
    (17, 21.59, 'R', 'Pete Sessions', 'Casey Shepard', '', '', 'Sessions seeking another term'),
    (18, -54.9, 'D', 'Ronald Whitfield', 'Christian Menefee', '', '', 'Al Green moved here from the 9th'),
    (19, 51.66, '', 'Tom Sell', 'Kyle Rable', '', '', 'Open seat, Arrington retiring'),
    (20, -28.44, 'D', 'Edgardo Rafael Baez', 'Joaquin Castro', '', '', 'Castro seeking an eighth term'),
    (21, 21.81, '', 'Mark Teixeira', 'Kristin Hook', '', '', 'Open seat, Roy ran for attorney general'),
    (22, 22.14, '', 'Trever Nehls', 'Marquette Greene-Scott', '', '', 'Open seat, Troy Nehls retiring, his brother Trever won the primary'),
    (23, 14.79, '', 'Brandon Herrera', 'Katy Padilla Stout', 'Ben Mendoza', 'I', 'Open seat, vacant going into the election'),
    (24, 16.08, 'R', 'Beth Van Duyne', 'Kevin Burge', '', '', 'Van Duyne seeking a fourth term'),
    (25, 24.06, 'R', 'Roger Williams', 'Dione Sims', '', '', 'Williams seeking an eighth term'),
    (26, 23.79, 'R', 'Brandon Gill', 'Steven Shook', 'Phil Gray', 'L', 'Gill seeking a second term'),
    (27, 21.17, 'R', 'Michael Cloud', 'Tanya Lloyd', '', '', 'Cloud seeking a fifth term'),
    (28, 10.37, 'D', 'Tano E. Tijerina', 'Henry Cuellar', 'Marlon Duran', 'G', 'Cuellar redrawn into a Trump district'),
    (29, -30.42, 'D', 'Martha Fierro', 'Sylvia Garcia', '', '', 'Garcia seeking a fifth term'),
    (30, -47.03, '', 'Everett Jackson', 'Frederick D. Haynes III', '', '', 'Open seat, Crockett ran for the Senate'),
    (31, 21.8, 'R', 'John Carter', 'Justin Early', 'Greg Stoker', 'G', 'Carter seeking a thirteenth term'),
    (32, 17.71, '', 'Jace Yarbrough', 'Dan Barrios', '', '', 'Open seat, Johnson ran in the 33rd and lost the runoff'),
    (33, -32.59, '', 'Patrick Gillespie', 'Colin Allred', '', '', 'Open seat, Veasey not on the ballot, Allred won the runoff'),
    (34, 10.13, 'D', 'Eric Flores', 'Vicente Gonzalez', 'Chris Royal', 'L', 'Gonzalez redrawn into a Trump district'),
    (35, 10.44, '', 'Carlos De La Cruz', 'Johnny Garcia', '', '', 'Open seat, Casar moved to the 37th'),
    (36, 24.93, 'R', 'Brian Babin', 'Rhonda Hart', '', '', 'Babin seeking a seventh term'),
    (37, -56.23, '', 'Lauren Pena', 'Greg Casar', '', '', 'Open seat, Doggett retired, Casar moved here'),
    (38, 20.91, '', 'Jon Bonck', 'Melissa McDonough', 'Alex McMenemy', 'G', 'Open seat, Hunt ran for the Senate'),
]
NY = [
    (1, 10.0, "R", "Nick LaLota", "Chris Gallant", "", "", "LaLota seeking a third term"),
    (2, 13.0, "R", "Andrew Garbarino", "Pat Halpin", "", "", "Garbarino seeking a fourth term"),
    (3, 4.0, "D", "Mike LiPetri", "Tom Suozzi", "", "", "Suozzi holds a Trump district"),
    (4, -1.0, "D", "Jeanine Driscoll", "Laura Gillen", "Blay Tarnoff", "L", "Gillen seeking a second term"),
    (5, -42.0, "D", "George Marsh", "Gregory Meeks", "", "", "Meeks seeking a fifteenth term"),
    (6, -6.0, "D", "Joseph Chou", "Grace Meng", "", "", "Meng seeking an eighth term"),
    (7, -46.0, "", "Melvin Rivera", "Claire Valdez", "Priscilla Ghaznavi", "I", "Open seat, Velazquez retiring"),
    (8, -44.0, "D", "Lewis Mizrahi", "Hakeem Jeffries", "", "", "Jeffries seeking an eighth term"),
    (9, -40.0, "D", "Joel Azumah", "Yvette Clarke", "", "", "Clarke seeking an eleventh term"),
    (10, -60.0, "", "Jennifer Moore", "Brad Lander", "", "", "Open in effect, Goldman lost the primary"),
    (11, 24.0, "R", "Nicole Malliotakis", "Mike DeCillis", "", "", "Malliotakis seeking a fourth term"),
    (12, -64.0, "", "Caroline Shinkle", "Micah Lasher", "Wilneida Negron", "I", "Open seat, Nadler retiring"),
    (13, -59.0, "", "Jomo Manuel Williams", "Darializa Avila Chevalier", "", "", "Open in effect, Espaillat lost the primary"),
    (14, -32.0, "D", "Diamant Hysenaj", "Alexandria Ocasio-Cortez", "", "", "Ocasio-Cortez seeking a fifth term"),
    (15, -49.0, "D", "Stylo Sapaskis", "Ritchie Torres", "Gonzalo Duran", "C", "Torres seeking a fourth term"),
    (16, -33.0, "D", "Joe Cinquemani", "George Latimer", "", "", "Latimer seeking a second term"),
    (17, -1.0, "R", "Mike Lawler", "Cait Conley", "", "", "Lawler holds a Harris district"),
    (18, -3.0, "D", "Jackie Auringer", "Pat Ryan", "", "", "Ryan seeking a third full term"),
    (19, -1.0, "D", "Peter Oberacker", "Josh Riley", "", "", "Riley seeking a second term"),
    (20, -14.0, "D", "Ralph Ambrosio", "Paul Tonko", "", "", "Tonko seeking a tenth term"),
    (21, 21.0, "", "Anthony Constantino", "Blake Gendebien", "", "", "Open seat, Stefanik not seeking reelection"),
    (22, -8.0, "D", "Kailee Buller", "John Mannion", "", "", "Mannion seeking a second term"),
    (23, 21.0, "R", "Nick Langworthy", "Aaron Gies", "", "", "Langworthy seeking a third term"),
    (24, 23.0, "R", "Claudia Tenney", "Alissa Ellman", "", "", "Tenney seeking a fifth term"),
    (25, -19.0, "D", "Virginia McIntyre", "Joe Morelle", "", "", "Morelle seeking a fifth full term"),
    (26, -19.0, "D", "Dennis Hannon", "Tim Kennedy", "", "", "Kennedy seeking a second full term"),
]
VA = [
    (1, 4.92, "R", "Rob Wittman", "Shannon Taylor", "", "", "Wittman seeking an eleventh term"),
    (2, 0.27, "R", "Jen Kiggans", "Elaine Luria", "", "", "Kiggans and Luria meet for the third time"),
    (3, -34.56, "D", "Edwin Rivera", "Bobby Scott", "Makiba Gaines", "I", "Scott seeking an eighteenth term"),
    (4, -32.59, "D", "Robert Murray", "Jennifer McClellan", "Joan Bell", "I", "McClellan seeking a third full term"),
    (5, 12.23, "R", "John McGuire", "Tom Perriello", "Cooke Harvey", "I", "Perriello held the seat from 2009 to 2011"),
    (6, 23.77, "R", "Ben Cline", "Beth Macy", "", "", "Cline seeking a fifth term"),
    (7, -2.85, "D", "Doug Ollivant", "Eugene Vindman", "Taner Lopez", "L", "Vindman seeking a second term"),
    (8, -49.28, "D", "Tony Sabio", "Don Beyer", "Shelly Arnoldi", "I", "Beyer seeking a seventh term"),
    (9, 43.91, "R", "Morgan Griffith", "Joy Powers", "", "", "Griffith seeking a ninth term"),
    (10, -8.31, "D", "Dave Beckwith", "Suhas Subramanyam", "Ahsen Malik", "I", "Subramanyam seeking a second term"),
    (11, -34.00, "D", "Arthur Purves", "James Walkinshaw", "Dianne Blais", "G", "Walkinshaw seeking a first full term"),
]
CA = [
    (1, -12, "R", "James Gallagher", "Mike McGuire", "", "", "Gallagher won the special here, the district was redrawn to D+12"),
    (2, -25, "D", "Robin Littau", "Jared Huffman", "", "", "Huffman seeking an eighth term"),
    (3, -10, "", "Robb Tucker", "Ami Bera", "", "", "Bera running here, he represents the new 6th"),
    (4, -15, "D", "Eric Jones", "Mike Thompson", "", "", "Two Democrats advanced"),
    (5, 21, "R", "Tom McClintock", "Michael Masuda", "", "", "McClintock seeking a tenth term"),
    (6, -8, "", "Kevin Kiley", "Richard Pan", "", "", "Kiley running as no party preference, he represents the new 3rd"),
    (7, -13, "D", "Mai Vang", "Doris Matsui", "", "", "Two Democrats advanced"),
    (8, -34, "D", "Rudy Recile", "John Garamendi", "", "", "Garamendi seeking a tenth term"),
    (9, -11, "D", "John McBride", "Josh Harder", "", "", "Harder seeking a fifth term"),
    (10, -34, "D", "Jeff Frese", "Mark DeSaulnier", "", "", "DeSaulnier seeking a seventh term"),
    (11, -68, "", "Connie Chan", "Scott Wiener", "", "", "Two Democrats advanced, Pelosi retiring"),
    (12, -74, "D", "Jamie Joyce", "Lateefah Simon", "", "", "Two Democrats advanced"),
    (13, 0, "D", "Kevin Lincoln", "Adam Gray", "", "", "Gray won 2024 by 187 votes"),
    (14, -35, "D", "Melissa Hernandez", "Aisha Wahab", "", "", "Two Democrats advanced"),
    (15, -48, "D", "Charles Hoelter", "Kevin Mullin", "", "", "Mullin seeking a third term"),
    (16, -48, "D", "Peter Soule", "Sam Liccardo", "", "", "Liccardo seeking a second term"),
    (17, -39, "D", "Ritesh Tandon", "Ro Khanna", "", "", "Khanna seeking a sixth term"),
    (18, -28, "D", "Shane Lewis", "Zoe Lofgren", "", "", "Lofgren seeking a seventeenth term"),
    (19, -34, "D", "Peter Verbica", "Jimmy Panetta", "", "", "Panetta seeking a sixth term"),
    (20, 32, "R", "Vince Fong", "Sandra Van Scotter", "", "", "Fong seeking a second full term"),
    (21, -6, "D", "Kyle Kirkland", "Jim Costa", "", "", "Costa seeking an eleventh term"),
    (22, 2, "R", "David Valadao", "Randy Villegas", "", "", "Valadao in the one Trump seat Prop 50 left competitive"),
    (23, 19, "R", "Jay Obernolte", "Tessa Lynn Hodge", "", "", "Obernolte seeking a fourth term"),
    (24, -25, "D", "Bob Smith", "Salud Carbajal", "", "", "Carbajal seeking a sixth term"),
    (25, -6, "D", "Joe Males", "Raul Ruiz", "", "", "Ruiz seeking an eighth term"),
    (26, -15, "", "Sam Gallucci", "Jacqui Irwin", "", "", "Open seat, Brownley retiring"),
    (27, -10, "D", "Jason Gibbs", "George Whitesides", "", "", "Whitesides seeking a second term"),
    (28, -25, "D", "April Verlato", "Judy Chu", "", "", "Chu seeking an eighth term"),
    (29, -34, "D", "Angelica Duenas", "Luz Rivas", "", "", "Two Democrats advanced"),
    (30, -40, "D", "Scott Meyers", "Laura Friedman", "", "", "Friedman seeking a second term"),
    (31, -12, "D", "Eric Ching", "Gil Cisneros", "", "", "Cisneros seeking a second term"),
    (32, -25, "D", "Larry Thompson", "Brad Sherman", "", "", "Sherman seeking a sixteenth term"),
    (33, -10, "D", "Stephanie Vargas", "Pete Aguilar", "", "", "Aguilar seeking a sixth term"),
    (34, -51, "D", "Angela Gonzales-Torres", "Jimmy Gomez", "", "", "Two Democrats advanced"),
    (35, -8, "D", "Mike Cargile", "Norma Torres", "", "", "Torres seeking a sixth term"),
    (36, -39, "D", "Houston Brignano", "Ted Lieu", "", "", "Lieu seeking a seventh term"),
    (37, -60, "D", "Samantha Mota", "Sydney Kamlager", "", "", "Two Democrats advanced"),
    (38, -12, "", "Pedro Casas", "Hilda Solis", "", "", "Open seat, Sanchez moved to the 41st"),
    (39, -9, "D", "Steve Manos", "Mark Takano", "", "", "Takano seeking an eighth term"),
    (40, 12, "R", "Young Kim", "Ken Calvert", "", "", "Two Republicans advanced, Calvert moved from the 41st"),
    (41, -14, "", "Mitch Clemmons", "Linda Sanchez", "", "", "Sanchez moved here from the 38th, Calvert left"),
    (42, -13, "D", "Brian Burley", "Robert Garcia", "", "", "Garcia seeking a third term"),
    (43, -49, "D", "Christian Morales", "Maxine Waters", "", "", "Waters seeking an eighteenth term"),
    (44, -35, "D", "Genevieve Angel", "Nanette Barragan", "", "", "Barragan seeking a fifth term"),
    (45, -4, "D", "Chuong Vo", "Derek Tran", "", "", "Tran seeking a second term"),
    (46, -16, "D", "David Pan", "Lou Correa", "", "", "Correa seeking a sixth term"),
    (47, -10, "D", "Jenny Rae LeRoux", "Dave Min", "", "", "Min seeking a second term"),
    (48, -3, "", "Jim Desmond", "Marni von Wilpert", "", "", "Open seat, Issa retiring, district redrawn D+3"),
    (49, -12, "D", "Armen Kurdian", "Mike Levin", "", "", "Levin seeking a fifth term"),
    (50, -18, "D", "Steve Cohen", "Scott Peters", "", "", "Peters seeking an eighth term"),
    (51, -18, "D", "Richard Cabrera", "Sara Jacobs", "", "", "Jacobs seeking a third term"),
    (52, -18, "D", "Jeff Belle", "Juan Vargas", "", "", "Vargas seeking an eighth term"),
]
SAMEPARTY_ALL = {"FL": {}, "TX": {}, "NYG": {}, "VA": {}}
SAMEPARTY = {"PAG": {3: "D"}, "NJ": {8: "D"}, "MA": {1: "D", 2: "D", 5: "D", 7: "D"}, "WIG": {2: "D"}, "CAG": {4: "D", 7: "D", 11: "D", 12: "D", 14: "D", 29: "D", 34: "D", 37: "D", 40: "R"}}
PA = [
    (1, 0.0, "R*", "Brian Fitzpatrick", "Bob Harvie", "", "", "Harris carried these lines 50 to 49, Fitzpatrick has held the seat since 2017"),
    (2, -36, "D", "Jessica Arriaga", "Brendan Boyle", "", "", "Boyle seeking a seventh term"),
    (3, -77, "", "No Republican on the ballot", "Chris Rabb", "Dennis Mahoney", "I", "Open seat, Evans retiring, no Republican filed"),
    (4, -16, "D", "Aurora Stuski", "Madeleine Dean", "", "", "Dean seeking a fifth term"),
    (5, -29, "D", "Nick Manganaro", "Mary Gay Scanlon", "", "", "Scanlon seeking a fifth term"),
    (6, -11, "D", "Marty Young", "Chrissy Houlahan", "", "", "Houlahan seeking a fifth term"),
    (7, 3, "R", "Ryan Mackenzie", "Bob Brooks", "", "", "Mackenzie seeking a second term"),
    (8, 9, "R", "Rob Bresnahan", "Paige Cognetti", "", "", "Cognetti is the mayor of Scranton"),
    (9, 38, "R", "Dan Meuser", "Rachel Wallace", "", "", "Meuser seeking a fifth term"),
    (10, 5, "R", "Scott Perry", "Janelle Stelson", "", "", "Rematch of a race Perry won narrowly in 2024"),
    (11, 21, "R", "Lloyd Smucker", "Nancy Mannion", "", "", "Smucker seeking a sixth term"),
    (12, -19, "D", "James Hayes", "Summer Lee", "Sergio Zambrana", "SWP", "Lee seeking a third term"),
    (13, 46, "R", "John Joyce", "Beth Farnham", "", "", "Joyce seeking a fifth term"),
    (14, 33, "R", "Guy Reschenthaler", "Alan Bradstock", "", "", "Reschenthaler seeking a fifth term"),
    (15, 38, "R", "Glenn Thompson", "Ray Bilger", "", "", "Thompson seeking a tenth term"),
    (16, 23, "R", "Mike Kelly", "Justin Wagner", "", "", "Kelly seeking a ninth term"),
    (17, -6, "D", "Tony Guy", "Chris Deluzio", "", "", "Deluzio seeking a third term"),
]
OH = [
    (1, 3, "D", "Eric Conroy", "Greg Landsman", "", "", "New map made this a Trump seat, Landsman is a crossover incumbent"),
    (2, 42, "R", "Dave Taylor", "Jen Mazzuckelli", "Kenneth Dietz", "I", "Taylor seeking a second term"),
    (3, -40, "D", "Cleophus Dulaney", "Joyce Beatty", "", "", "Beatty seeking an eighth term"),
    (4, 43, "R", "Jim Jordan", "Josh Kolasinski", "Tracey Tackett", "I", "Jordan seeking a eleventh term"),
    (5, 24, "R", "Bob Latta", "Brian Shaver", "Michael Veloff", "L", "Latta seeking a tenth term"),
    (6, 35, "R", "Michael Rulli", "Elizabeth Kirtley", "", "", "Rulli seeking a second full term"),
    (7, 11, "R", "Max Miller", "Brian Poindexter", "", "", "Miller seeking a third term"),
    (8, 16, "R", "Warren Davidson", "Vanessa Enoch", "", "", "Davidson seeking a sixth full term"),
    (9, 11, "D", "Derek Merrin", "Marcy Kaptur", "", "", "New map made this a Trump seat, Kaptur is a crossover incumbent"),
    (10, 8, "R", "Mike Turner", "Kristina Knickerbocker", "Tom McMasters", "L", "Turner seeking a thirteenth term"),
    (11, -55, "D", "Mike Kirchner", "Shontel Brown", "", "", "Brown seeking a fourth full term"),
    (12, 30, "R", "Troy Balderson", "Jerrad Christian", "", "", "Balderson seeking a fifth full term"),
    (13, -3, "D", "Carey Coleman", "Emilia Sykes", "", "", "Sykes kept a Democratic leaning seat in the redraw"),
    (14, 20, "R", "Dave Joyce", "Maria Jukic", "", "", "Joyce seeking an eighth term"),
    (15, 10, "R", "Mike Carey", "Don Leonard", "Brennan Barrington", "L", "Carey seeking a third full term"),
]
NC = [
    (1, 12, "D", "Laurie Buckhout", "Don Davis", "Tom Bailey", "L", "Davis running in a seat the 2025 redraw made Republican"),
    (2, -34, "D", "Gene Douglass", "Deborah Ross", "Matthew Laszacs", "L", "Ross seeking a fourth term"),
    (3, 14, "R", "Greg Murphy", "Raymond Smith Jr.", "Daniel Cavender", "L", "Murphy seeking a fifth full term"),
    (4, -45, "D", "Max Ganorkar", "Valerie Foushee", "Guy Meilleur", "L", "Foushee seeking a third term"),
    (5, 18, "R", "Virginia Foxx", "Chuck Hubbard", "Robert Luffman", "L", "Foxx seeking a twelfth term"),
    (6, 17, "R", "Addison McDowell", "Cyril Jefferson", "", "", "McDowell seeking a second term"),
    (7, 14, "R", "David Rouzer", "Kim Hardy", "Maad Abu-Ghazalah", "L", "Rouzer seeking a seventh term"),
    (8, 19, "R", "Mark Harris", "Colby Watson", "Bo Whitehead", "G", "Harris seeking a second term"),
    (9, 16, "R", "Richard Hudson", "Richard Ojeda", "", "", "Hudson seeking an eighth term"),
    (10, 18, "R", "Pat Harrigan", "Ashley Bell", "Steve Feldman", "L", "Harrigan seeking a second term"),
    (11, 10, "", "Jennifer Balkcom", "Jamie Ager", "Travis Groo", "L", "Edwards withdrew in August, Balkcom named by the district committee"),
    (12, -46, "D", "Jack Codiga", "Alma Adams", "", "", "Adams seeking a seventh full term"),
    (13, 16, "R", "Brad Knott", "Paul Barringer", "Steven Swinton", "L", "Knott seeking a second term"),
    (14, 15, "R", "Tim Moore", "LaKesha Womack", "", "", "Moore seeking a second term"),
]
MI = [
    (1, 21, "R", "Jack Bergman", "Callie Barr", "LaVeta Davenport", "G", "Bergman seeking a sixth term"),
    (2, 30, "R", "John Moolenaar", "Ben Ambrose", "Charlotte Magoon", "G", "Moolenaar seeking a fifth term"),
    (3, -8, "D", "Terri DeBoer", "Hillary Scholten", "Joe Jock", "G", "Scholten seeking a third term"),
    (4, 6, "R", "Bill Huizenga", "Sean McCann", "Shafina Barnett", "G", "Huizenga seeking an ninth term"),
    (5, 27, "R", "Tim Walberg", "Christian Vukasovich", "James Bronke", "G", "Walberg seeking a tenth term"),
    (6, -23, "D", "Heather Smiley", "Debbie Dingell", "Clyde Shabazz", "G", "Dingell seeking a seventh term"),
    (7, 1, "R", "Tom Barrett", "William Lawrence", "Shane Dedrick", "G", "Barrett seeking a second term"),
    (8, 2, "D", "Thomas J. Smith", "Kristen McDonald Rivet", "Jim Casha", "G", "Smith won the primary after suspending his campaign"),
    (9, 32, "R", "Lisa McClain", "Ray Pooley", "Destiny Clayton", "G", "McClain seeking a fourth term"),
    (10, 7, "", "Michael Bouchard", "Christina Hines", "Kwabena Nkromo", "G", "Open seat, James running for governor"),
    (11, -16, "", "Ethan Baker", "Jeremy Moss", "Ryan Teasdale", "G", "Open seat, Stevens running for the Senate"),
    (12, -38, "D", "James Hooper", "Rashida Tlaib", "Brenda Sanders", "G", "Tlaib seeking a fourth term"),
    (13, -41, "", "T.P. Nykoriak", "Donavan McKinney", "", "", "Open in effect, Thanedar lost the primary"),
]
GA = [
    (1, 16, "", "Jim Kingston", "Amanda Hollowell", "", "", "Open seat, Carter running for the Senate"),
    (2, -8, "D", "Matt Day", "Sanford Bishop", "", "", "Bishop seeking a eighteenth term"),
    (3, 30, "R", "Brian Jack", "Maura Keller", "", "", "Jack seeking a second term"),
    (4, -52, "D", "Jim Duffie", "Hank Johnson", "", "", "Johnson seeking a eleventh term"),
    (5, -72, "D", "John Salvesen", "Nikema Williams", "", "", "Williams seeking a fourth term"),
    (6, -50, "D", "Kevin Martin", "Lucy McBath", "", "", "McBath seeking a fifth term"),
    (7, 22, "R", "Rich McCormick", "Tony Kozycki", "", "", "McCormick seeking a third term"),
    (8, 31, "R", "Austin Scott", "Kelly Esti", "", "", "Scott seeking a ninth term"),
    (9, 34, "R", "Andrew Clyde", "Caitlyn Gegen", "", "", "Clyde seeking a fourth term"),
    (10, 21, "", "Houston Gaines", "Pam DeLancy", "", "", "Open seat, Collins running for the Senate"),
    (11, 23, "", "John Cowan", "Chris Harden", "", "", "Open seat, Loudermilk retiring"),
    (12, 14, "R", "Rick Allen", "Ceretta Smith", "", "", "Allen seeking a seventh term"),
    (13, -42, "", "Jonathan Chavez", "Jasmine Clark", "", "", "Open, Scott died in April and Blair is not on the November ballot"),
    (14, 37, "R", "Clay Fuller", "Shawn Harris", "Andrew Underwood", "L", "Fuller won the special after Greene resigned"),
]
IL = [
    (1, -32, "D", "Christian Maxwell", "Jonathan Jackson", "", "", "Jackson seeking a third term"),
    (2, -33, "", "Michael Noack", "Donna Miller", "", "", "Open seat, Kelly ran for the Senate"),
    (3, -31, "D", "Angel Oakley", "Delia Ramirez", "", "", "Ramirez seeking a third term"),
    (4, -28, "", "Lupe Castillo", "Patty Garcia", "Ed Hershey", "I", "Open seat, Garcia retiring"),
    (5, -37, "D", "Tommy Hanson", "Mike Quigley", "", "", "Quigley seeking a tenth full term"),
    (6, -5, "D", "Niki Conforti", "Sean Casten", "", "", "Rematch of 2024"),
    (7, -65, "", "Chad Koppie", "La Shawn Ford", "", "", "Open seat, Davis retiring"),
    (8, -7, "", "Jennifer Davis", "Melissa Bean", "", "", "Open seat, Krishnamoorthi ran for the Senate"),
    (9, -37, "", "John Elleson", "Daniel Biss", "", "", "Open seat, Schakowsky retiring"),
    (10, -22, "D", "Carl Lambrecht", "Brad Schneider", "", "", "Schneider seeking an eighth term"),
    (11, -11, "D", "Jeff Walter", "Bill Foster", "", "", "Foster seeking a tenth term"),
    (12, 43, "R", "Mike Bost", "Julie Fortier", "", "", "Bost seeking a seventh term"),
    (13, -10, "D", "Jeff Wilson", "Nikki Budzinski", "", "", "Budzinski seeking a third term"),
    (14, -5, "D", "Jim Marter", "Lauren Underwood", "", "", "Underwood seeking a fifth term"),
    (15, 40, "R", "Mary Miller", "Jennifer Todd", "", "", "Miller seeking a fourth term"),
    (16, 23, "R", "Darin LaHood", "Paul Nolley", "", "", "LaHood seeking a fifth full term"),
    (17, -5, "D", "Dillan Vancil", "Eric Sorensen", "", "", "Sorensen seeking a third term"),
]
NJ = [
    (1, -19, "D", "Damon Galdo", "Donald Norcross", "", "", "Norcross seeking a seventh full term"),
    (2, 13, "R", "Jeff Van Drew", "Zack Mullock", "Ramon Mora Jr.", "I", "Van Drew seeking a sixth term"),
    (3, -8, "D", "Michael McGuire", "Herb Conaway", "Steve Welzer", "G", "Conaway seeking a second term"),
    (4, 30, "R", "Chris Smith", "Rachel Peace", "", "", "Smith seeking a twenty fourth term"),
    (5, -2, "D", "Sean Kirrane", "Josh Gottheimer", "Adam Rueda", "I", "Gottheimer seeking a sixth term"),
    (6, -6, "D", "Hillary Herzig", "Frank Pallone", "", "", "Pallone seeking a twentieth full term"),
    (7, 1, "R", "Tom Kean Jr.", "Rebecca Bennett", "Lana Leguia", "L", "Kean seeking a third term"),
    (8, -24, "D", "No Republican on the ballot", "Rob Menendez", "Craig Honts", "SWP", "No Republican filed"),
    (9, 1, "D", "Rosie Pino", "Nellie Pou", "Terrisa Bukovinac", "I", "Pou holds a district Trump carried"),
    (10, -51, "D", "Carmen Bucco", "LaMonica McIver", "", "", "McIver seeking a second full term"),
    (11, -9, "D", "Joe Hathaway", "Analilia Mejia", "Alan Bond", "I", "Mejia won the special after Sherrill became governor"),
    (12, -24, "", "Gregg Mele", "Adam Hamawy", "Andres Jinete", "G", "Open seat, Watson Coleman retiring"),
]
WA = [
    (1, -29, "D", "Mary Silva", "Suzan DelBene", "", "", "DelBene seeking an eighth full term"),
    (2, -24, "D", "Edwin Feller", "Rick Larsen", "", "", "Larsen seeking a twelfth term"),
    (3, 3, "D", "John Braun", "Marie Gluesenkamp Perez", "", "", "Braun led the top two primary, Gluesenkamp Perez is a crossover incumbent"),
    (4, 21, "", "Amanda McKinney", "John Duresky", "", "", "Open seat, Newhouse retiring"),
    (5, 11, "R", "Michael Baumgartner", "Carmela Conroy", "", "", "Baumgartner seeking a second term"),
    (6, -19, "D", "Teresa Fox", "Emily Randall", "", "", "Randall seeking a second term"),
    (7, -75, "D", "Nirav Sheth", "Pramila Jayapal", "", "", "Jayapal seeking a sixth term"),
    (8, -6, "D", "Spencer Meline", "Kim Schrier", "", "", "Schrier seeking a fifth term"),
    (9, -41, "D", "Doug Basler", "Adam Smith", "", "", "Smith seeking a sixteenth term"),
    (10, -18, "D", "Chris Chung", "Marilyn Strickland", "", "", "Strickland seeking a fourth term"),
]
AZ = [
    (1, 3, "", "Jay Feely", "Amish Shah", "Monica Alponte", "L", "Open seat, Schweikert running for governor"),
    (2, 15, "R", "Eli Crane", "Jonathan Nez", "Curtis Goodwin", "L", "Crane seeking a third term"),
    (3, -40, "D", "Nicholas Glenn", "Yassamin Ansari", "David Redkey", "G", "Ansari seeking a second term"),
    (4, -7, "D", "Zuhdi Jasser", "Greg Stanton", "Tisha Benoit", "I", "Stanton seeking a fifth term"),
    (5, 20, "", "Mark Lamb", "Elizabeth Lee", "Blake Bracht", "I", "Open seat, Biggs running for governor"),
    (6, 1, "R", "Juan Ciscomani", "JoAnna Mendoza", "Jereme Peters", "L", "Ciscomani seeking a third term"),
    (7, -22, "D", "Daniel Butierez", "Adelita Grijalva", "", "", "Rematch of the 2025 special after Raul Grijalva died"),
    (8, 16, "R", "Abraham Hamadeh", "Bernadette Greene-Placentia", "Jessie Martines", "L", "Hamadeh seeking a second term"),
    (9, 31, "R", "Paul Gosar", "Danielle Sterbinsky", "", "", "Gosar seeking a eighth term"),
]
TN = [
    (1, 58, "R", "Diana Harshbarger", "Kristi Burke", "Joshua Ashburn", "I", "Harshbarger seeking a fourth term"),
    (2, 34, "R", "Tim Burchett", "Michaela Barnett", "Bruce Fine", "I", "Burchett seeking a fourth term"),
    (3, 36, "R", "Chuck Fleischmann", "Anna Golladay", "Dean Arnold", "I", "Fleischmann seeking a ninth term"),
    (4, 24, "R", "Scott DesJarlais", "Victoria Broderick", "Jacob Anders", "I", "DesJarlais seeking a ninth term"),
    (5, 23, "", "Charlie Hatcher", "Chaz Molder", "James Johnson", "I", "Ogles lost the primary to Hatcher"),
    (6, 27, "", "Johnny Garrett", "Mike Croley", "Christopher Monday", "I", "Open seat, Rose running for governor"),
    (7, 22, "R", "Matt Van Epps", "Darden Copeland", "Andrew Koontz", "I", "Van Epps won the December 2025 special"),
    (8, 20, "R", "David Kustoff", "Heidi Kuhn", "Adam Austill", "I", "Kustoff seeking a sixth term"),
    (9, 21, "", "Brent Taylor", "Justin Pearson", "Dennis Clark", "I", "Open, Cohen retired after the redraw dismantled his seat"),
]
MA = [
    (1, -14, "D", "No Republican on the ballot", "Richard Neal", "Nadia Milleron", "I", "No Republican filed"),
    (2, -24, "D", "No Republican on the ballot", "Jim McGovern", "", "", "No Republican filed"),
    (3, -19, "D", "Gary Grossi", "Lori Trahan", "Dennis Conlon", "I", "Trahan seeking a fifth term"),
    (4, -20, "D", "Thomas Stalcup", "Jake Auchincloss", "", "", "Auchincloss seeking a fourth term"),
    (5, -45, "D", "No Republican on the ballot", "Katherine Clark", "", "", "No Republican filed"),
    (6, -21, "", "Micah Quinney Jones", "Dan Koh", "", "", "Open seat, Moulton lost the Senate primary"),
    (7, -63, "D", "No Republican on the ballot", "Ayanna Pressley", "", "", "No Republican filed"),
    (8, -26, "D", "Robert Burke", "Stephen Lynch", "Rasheed Walters", "I", "Lynch seeking a thirteenth full term"),
    (9, -11, "D", "Tyler Macallister", "Bill Keating", "", "", "Keating seeking a eighth term"),
]
MO = [
    (1, -57.13, "D", "Paul Berry III", "Wesley Bell", "Tom Schmitz", "L", "Bell beat former Rep. Cori Bush in the primary"),
    (2, 7.95, "R", "Ann Wagner", "Fred Wellman", "Brandon Daugherty", "L", "Wagner seeking a eighth term"),
    (3, 26.72, "R", "Bob Onder", "Bethany Mann", "Jim Higgins", "L", "Onder seeking a second term"),
    (4, 42.12, "R", "Mark Alford", "Jordan Herrera", "Thomas Holbrook", "L", "Alford seeking a third term"),
    (5, -23.40, "D", "Rick Brattin", "Emanuel Cleaver", "Randall Langkraehr", "L", "The seat the blocked 2025 map targeted"),
    (6, 38.85, "", "Chris Stigall", "Josh Smead", "Andy Maidment", "L", "Open seat, Graves retiring"),
    (7, 42.65, "R", "Eric Burlison", "Missi Hesketh", "Kevin Craig", "L", "Burlison seeking a third term"),
    (8, 53.89, "R", "Jason Smith", "Chris Reichard", "Rebecca Lombard", "L", "Smith seeking a eighth full term"),
]
MD = [
    (1, 17, "R", "Andy Harris", "Dan Schwartz", "Edward Shlikas", "I", "The seat the failed redraw targeted"),
    (2, -18, "D", "Dave Wallace", "Johnny Olszewski", "", "", "Olszewski seeking a second term"),
    (3, -24, "D", "Berney Flowers", "Sarah Elfreth", "", "", "Elfreth seeking a second term"),
    (4, -74, "D", "George McDermott", "Glenn Ivey", "Sam Husseini", "G", "Ivey seeking a third term"),
    (5, -33, "", "Chris Chaffee", "Adrian Boafo", "", "", "Open seat, Hoyer retiring after four decades"),
    (6, -6, "D", "Robin Ficker", "April McClain Delaney", "Moshe Landman", "G", "McClain Delaney seeking a second term"),
    (7, -59, "D", "Scott Collier", "Kweisi Mfume", "", "", "Mfume seeking a fifth full term"),
    (8, -56, "D", "Cheryl Riley", "Jamie Raskin", "Nancy Wallace", "G", "Raskin seeking a sixth term"),
]
MN = [
    (1, 12, "R", "Brad Finstad", "Jake Johnson", "", "", "Finstad seeking a third full term"),
    (2, -6, "", "Eric Pratt", "Matt Little", "", "", "Open seat, Craig running for the Senate"),
    (3, -21, "D", "Tyler Bass", "Kelly Morrison", "", "", "Morrison seeking a second term"),
    (4, -36, "D", "Paul Wikstrom", "Betty McCollum", "", "", "McCollum seeking a fourteenth term"),
    (5, -62, "D", "John Nagel", "Ilhan Omar", "DeVelle Jackson", "I", "Omar seeking a fifth term"),
    (6, 20, "R", "Tom Emmer", "Doug Chapin", "", "", "Emmer seeking a eleventh term"),
    (7, 36, "R", "Michelle Fischbach", "Erik Osberg", "", "", "Fischbach seeking a fourth term"),
    (8, 14, "R", "Pete Stauber", "Trina Swanson", "", "", "Stauber seeking a fifth term"),
]
WI = [
    (1, 5, "R", "Bryan Steil", "Mitchell Berman", "", "", "Steil seeking a fifth term"),
    (2, -40, "D", "No Republican on the ballot", "Mark Pocan", "", "", "No Republican filed"),
    (3, 7, "R", "Derrick Van Orden", "Rebecca Cooke", "Alexander Kent", "I", "Third meeting between these two"),
    (4, -52, "D", "Tim Rogers", "Gwen Moore", "Arthur Burks", "I", "Moore seeking a eleventh term"),
    (5, 22, "R", "Scott Fitzgerald", "Andy Beck", "", "", "Fitzgerald seeking a fourth term"),
    (6, 16, "R", "Glenn Grothman", "Brad Smith", "Matthew Arndt", "G", "Grothman seeking a seventh term"),
    (7, 23, "", "Michael Alfonso", "Fred Clark", "", "", "Open seat, Tiffany running for governor"),
    (8, 16, "R", "Tony Wied", "Rick Crosson", "", "", "Wied seeking a second full term"),
]
CO = [
    (1, -56, "", "Christy Peterson", "Melat Kiros", "Chad Humphrey", "L", "Kiros beat DeGette in the primary after 28 years"),
    (2, -40, "D", "Kelley Dennison", "Joe Neguse", "Gaylon Kent", "L", "Neguse seeking a fifth term"),
    (3, 10, "R", "Jeff Hurd", "Dwayne Romero", "Cory Robertson", "L", "Hurd seeking a second term"),
    (4, 18, "R", "Lauren Boebert", "Eileen Laubacher", "Douglas Mangeris", "L", "Boebert seeking a fourth term"),
    (5, 9, "R", "Jeff Crank", "Jessica Killin", "Christopher Mitchell", "I", "Crank seeking a second term"),
    (6, -20, "D", "Jason Clark", "Jason Crow", "Patty McMahan", "L", "Crow seeking a fifth term"),
    (7, -15, "D", "Tim Bennett", "Brittany Pettersen", "Dan Sallis", "L", "Pettersen seeking a second term"),
    (8, 2, "R", "Gabe Evans", "Manny Rutinel", "Dave Wood", "L", "Colorado's one seat inside two points"),
]
IN = [
    (1, -0.4, "D", "Barb Regnitz", "Frank Mrvan", "", "", "Mrvan holds a seat that went even in 2024"),
    (2, 27, "R", "Rudy Yakym", "Jamee Decio", "William Henry", "L", "Yakym seeking a third full term"),
    (3, 31, "R", "Marlin Stutzman", "Kelly Thompson", "", "", "Stutzman seeking a second term"),
    (4, 29, "R", "Jim Baird", "Drew Cox", "", "", "Baird seeking a fifth term"),
    (5, 17, "R", "Victoria Spartz", "J.D. Ford", "", "", "Spartz seeking a fourth term"),
    (6, 33, "R", "Jefferson Shreve", "Cinde Wirth", "", "", "Shreve seeking a second term"),
    (7, -41, "D", "Patrick McAuley", "Andre Carson", "James Sceniak", "L", "Carson seeking a tenth full term"),
    (8, 36, "R", "Mark Messmer", "Mary Allen", "", "", "Messmer seeking a second term"),
    (9, 30, "R", "Erin Houchin", "Brad Meyer", "Tonya Hudson", "L", "Houchin seeking a third term"),
]
OR = [
    (1, -38, "D", "Barbara Kahl", "Suzanne Bonamici", "", "", "Bonamici seeking a eighth full term"),
    (2, 27, "R", "Cliff Bentz", "Chris Beck", "", "", "Bentz seeking a fourth term"),
    (3, -46, "D", "Loran Ayles", "Maxine Dexter", "", "", "Dexter seeking a second term"),
    (4, -12, "D", "Monique DeSpain", "Val Hoyle", "Justin Filip", "G", "Hoyle seeking a third term"),
    (5, -9, "D", "Patti Adair", "Janelle Bynum", "Andrea Thorn Townsend", "G", "Bynum seeking a second term"),
    (6, -11, "D", "David Russ", "Andrea Salinas", "", "", "Salinas seeking a third term"),
]
NV = [
    (1, -2, "D", "Carrie Buck", "Dina Titus", "Afzal Khan", "I", "Titus seeking a eighth term"),
    (2, 14, "", "David Flippo", "Teresa Benitez-Thompson", "Lynn Chapman", "I", "Open seat, Amodei retiring"),
    (3, 1, "D", "Marty O'Donnell", "Susie Lee", "Jon Kamerath", "I", "Lee holds a district Trump carried"),
    (4, -2, "D", "Cody Whipple", "Steven Horsford", "Russ Best", "I", "Horsford seeking a fifth full term"),
]
UT = [
    (1, -24, "", "Riley Owen", "Ben McAdams", "Jesse West", "L", "New Salt Lake seat, open, McAdams held the old 4th"),
    (2, 29, "R", "Blake Moore", "Peter Crosby", "Daniel Cottam", "L", "Moore moved here from the old 1st"),
    (3, 41, "R", "Celeste Maloy", "Kent Udell", "Mike Stoddard", "L", "Maloy moved here from the old 2nd"),
    (4, 33, "R", "Mike Kennedy", "Jonny Larsen", "Taylor Wright", "L", "Kennedy moved here from the old 3rd"),
]
AK = [
    (1, 13, "R", "Nick Begich III", "Bill Hill", "Jim McDermott", "L", "Ranked choice, Hill is an independent and the effective challenger"),
]
HI = [
    (1, -25, "D", "Adriel Lam", "Ed Case", "Jordan Conley", "G", "Case seeking a sixth full term"),
    (2, -22, "D", "Brenton Awa", "Jill Tokuda", "Edward Codelia", "I", "Tokuda seeking a third term"),
]
ID = [
    (1, 45, "R", "Russ Fulcher", "Kaylee Peterson", "Sarah Zabel", "I", "Fulcher seeking a fifth term"),
    (2, 27, "R", "Mike Simpson", "Ellie Gilbreath", "Will Johanson", "L", "Simpson seeking a fifteenth term"),
]
WY = [
    (1, 46, "", "Chuck Gray", "Lisa Kinney", "Jeff Haggit", "I", "Open seat, Hageman running for the Senate"),
]
MT = [
    (1, 12, "", "Aaron Flint", "Sam Forstag", "Nick Sheedy", "L", "Open seat, Zinke retiring"),
    (2, 30, "R", "Troy Downing", "Brian Miller", "Patrick McCracken", "L", "Downing seeking a second term"),
]
ND = [
    (1, 37, "R", "Julie Fedorchak", "Trygve Hammer", "Helene Neville", "I", "Rematch of 2024, Fedorchak seeking a second term"),
]
SD = [
    (1, 29, "", "Marty Jackley", "Nikki Gronli", "", "", "Open seat, Johnson ran for governor and lost the primary"),
]
NE = [
    (1, 13, "R", "Mike Flood", "Chris Backemeyer", "Nik Sandman", "L", "Flood seeking a third full term"),
    (2, -5, "", "Brinker Harding", "Denise Powell", "Eric Michael Foreman", "L", "Open seat, Bacon retiring, Harris carried it"),
    (3, 54, "R", "Adrian Smith", "Becky Stille", "Dave Else", "I", "Smith seeking a eleventh term"),
]
KS = [
    (1, 31, "R", "Tracey Mann", "Lauren Reinhold", "Steve Jacob", "L", "Mann seeking a fourth term"),
    (2, 20, "R", "Derek Schmidt", "Don Coover", "John Hauer", "L", "Schmidt seeking a second term"),
    (3, -4, "D", "Eric Jenkins", "Sharice Davids", "Steve Hohe", "L", "Davids survived the failed redraw aimed at her"),
    (4, 23, "R", "Ron Estes", "Katy Tyndell", "Drew Cranmer", "L", "Estes seeking a sixth full term"),
]
OK = [
    (1, 22, "", "Mark Tedford", "John Croisant", "", "", "Open seat, Hern running for the Senate"),
    (2, 56, "R", "Josh Brecheen", "Brandon Wade", "Ronnie Hopkins", "I", "Brecheen seeking a third term"),
    (3, 46, "R", "Frank Lucas", "Suzie Byrd", "", "", "Lucas seeking a seventeenth term"),
    (4, 33, "R", "Tom Cole", "Mitchell Jacob", "Rocco Bonacci", "I", "Cole seeking a thirteenth term"),
    (5, 18, "R", "Stephanie Bice", "Jena Nelson", "Robert Henri", "I", "Bice seeking a fourth term"),
]
# --- eastern and southern batch: NM AR IA LA MS AL SC KY WV CT RI VT NH ME ---
# spine: The Downballot's 2024 presidential calculations on the lines in force for 2026, Trump margin
NM = [
    (1, -13, "D", "Ndidiamaka Okpareke", "Melanie Stansbury", "", "", "Stansbury seeking a fourth full term"),
    (2, 2, "D", "Greg Cunningham", "Gabe Vasquez", "", "", "Vasquez holds a district Trump carried"),
    (3, -5, "D", "Martin Zamora", "Teresa Leger Fernandez", "", "", "Leger Fernandez seeking a fourth term"),
]
AR = [
    (1, 45, "R", "Rick Crawford", "Terri Yarbrough Green", "Steve Parsons", "L", "Crawford seeking a ninth term"),
    (2, 16, "R", "French Hill", "Chris Jones", "", "", "Hill faces the 2022 nominee for governor"),
    (3, 25, "R", "Steve Womack", "Robb Ryerse", "Bobby Wilson", "L", "Womack seeking a ninth term"),
    (4, 40, "R", "Bruce Westerman", "James Russell III", "", "", "Westerman seeking a seventh term"),
]
IA = [
    (1, 8, "R", "Mariannette Miller-Meeks", "Christina Bohannan", "Michael Bridgford", "I", "Third meeting of Miller-Meeks and Bohannan, with an independent polling in double digits"),
    (2, 10, "", "Joe Mitchell", "Lindsay James", "Rick Stewart", "L", "Open seat, Hinson running for the Senate"),
    (3, 4, "R", "Zach Nunn", "Sarah Trone Garriott", "", "", "Nunn seeking a third term"),
    (4, 31, "", "Chris McGowan", "Dave Dawson", "", "", "Open seat, Feenstra ran for governor and lost the primary"),
]
LA = [
    (1, 38, "R", "Steve Scalise", "Lauren Jewett", "Liddy Glass", "I", "Scalise seeking a tenth full term"),
    (2, -47, "D", "Peter Williams", "Troy Carter", "", "", "Carter's seat absorbed much of Baton Rouge and is the state's one majority Black district"),
    (3, 36, "R", "Clay Higgins", "John Day", "Tia LeBrun", "I", "Higgins seeking a sixth term"),
    (4, 34, "R", "Mike Johnson", "Conrad Cable", "", "", "Speaker Johnson seeking a sixth term"),
    (5, 34, "", "Michael Echols", "Pat Moore", "", "", "Open seat, Letlow ran for the Senate, all party primary with several candidates a side"),
    (6, 30, "", "Blake Miguez", "Chauna Banks", "Rufus Craig", "L", "Fields's Black opportunity seat was dismantled and he is running for the state Senate instead"),
]
MS = [
    (1, 37, "R", "Trent Kelly", "Cliff Johnson", "Johnny Baucom", "L", "Kelly seeking a sixth full term"),
    (2, -20, "D", "Ron Eller", "Bennie Thompson", "Bennie Foster", "I", "Thompson has held this seat since 1993"),
    (3, 29, "R", "Michael Guest", "Michael Chiaradio", "Erik Kiehle", "L", "Guest seeking a fifth term"),
    (4, 43, "R", "Mike Ezell", "Jeffrey Hulum III", "Carl Boyanton", "I", "Ezell seeking a third term"),
]
AL = [
    (1, 36, "", "Jerry Carl", "Clyde Jones", "", "", "Open seat, Moore running for the Senate, Carl returning after losing the 2024 primary"),
    (2, 14, "D", "Rhett Marques", "Shomari Figures", "", "", "Figures redrawn into a Trump district when the 2023 map was reinstated"),
    (3, 47, "R", "Mike Rogers", "Lee McInnis", "", "", "Rogers seeking a thirteenth term"),
    (4, 66, "R", "Robert Aderholt", "Amanda Pusczek", "", "", "Aderholt seeking a sixteenth term in the most Republican district in the state"),
    (5, 29, "R", "Dale Strong", "Andrew Sneed", "", "", "Strong seeking a third term"),
    (6, 35, "R", "Gary Palmer", "Maurice Mercer", "", "", "Palmer seeking a seventh term"),
    (7, -18, "D", "Ammie Akin", "Terri Sewell", "", "", "Sewell in the state's one remaining Black majority district"),
]
SC = [
    (1, 13, "", "Jenny Costa Honeycutt", "Nancy Lacore", "Bill Reeside Jr.", "L", "Open seat, Mace ran for governor and finished last in the primary"),
    (2, 14, "R", "Joe Wilson", "Zyon Khalifa", "Dayna Smith", "WP", "Wilson seeking a fourteenth term"),
    (3, 43, "R", "Sheri Biggs", "Eunice Lehmacher", "Brian Corriea", "L", "Biggs seeking a second term"),
    (4, 24, "R", "William Timmons", "Courtney McClain", "Jessica Ethridge", "L", "Timmons seeking a fifth term"),
    (5, 23, "", "Wes Climer", "Mallory Dittmer", "Andy Kaplan", "FWD", "Open seat, Norman running for governor"),
    (6, -23, "D", "John Peterson", "Jim Clyburn", "Joseph Oddo", "AP", "Clyburn has held this seat since 1993"),
    (7, 26, "R", "Russell Fry", "John Gregory Vincent", "", "", "Fry seeking a third term"),
]
KY = [
    (1, 47, "R", "James Comer", "Drew Williams", "", "", "Comer seeking a sixth full term"),
    (2, 41, "R", "Brett Guthrie", "Megan Wingfield", "Thomas Loecken", "I", "Guthrie seeking a tenth term"),
    (3, -19, "D", "Maria Teresa Rodriguez", "Morgan McGarvey", "", "", "McGarvey holds the state's one Democratic seat"),
    (4, 36, "", "Ed Gallrein", "Melissa Claire Strange", "Jeremy Todd", "L", "Open in effect, Massie lost the primary to a Trump endorsed challenger"),
    (5, 64, "R", "Hal Rogers", "Ned Pillersdorf", "Gerardo Serrano", "I", "Rogers in the most Republican district in the country"),
    (6, 15, "", "Ralph Alvarado", "Zach Dembo", "Jay Bowman", "I", "Open seat, Barr running for the Senate"),
]
WV = [
    (1, 44, "R", "Carol Miller", "Vince George", "Belinda Fox-Spencer", "C", "Miller seeking a fifth term"),
    (2, 40, "R", "Riley Moore", "Ace Parsi", "", "", "Moore seeking a second term"),
]
CT = [
    (1, -23, "", "Amy Fogelstrom Chai", "Luke Bronin", "Mary Sanders", "G", "Open in effect, Larson lost the primary to the former mayor of Hartford"),
    (2, -8, "D", "George Patrick Austin", "Joe Courtney", "", "", "Courtney seeking a eleventh term"),
    (3, -14, "D", "Christopher Lancia", "Rosa DeLauro", "Tom Egan", "IP", "DeLauro seeking a nineteenth term"),
    (4, -23, "D", "Michael Goldstein", "Jim Himes", "Benjamin Wesley", "IP", "Himes seeking a tenth term"),
    (5, -6, "D", "Chris Shea", "Jahana Hayes", "", "", "Hayes in the state's closest seat on paper"),
]
RI = [
    (1, -22, "D", "Kellie Keenan", "Gabe Amo", "", "", "Amo seeking a second full term"),
    (2, -7, "D", "Vic Mellor", "Seth Magaziner", "", "", "Magaziner seeking a third term"),
]
VT = [
    (1, -32, "D", "Gerald Malloy", "Becca Balint", "Adam Ortiz", "I", "Balint seeking a third term in the at large seat"),
]
NH = [
    (1, -2, "", "Anthony DiLorenzo", "Stefany Shaheen", "", "", "Open seat, Pappas running for the Senate"),
    (2, -4, "D", "Lily Tang Williams", "Maggie Goodlander", "Robbie Mahrou", "I", "Rematch of 2024, Goodlander seeking a second term"),
]
ME = [
    (1, -22, "D", "Ron Russell", "Chellie Pingree", "", "", "Rematch of 2024, Pingree seeking a tenth term"),
    (2, 9, "", "Paul LePage", "Matt Dunlap", "", "", "Open seat, Golden retiring, the former governor against the state auditor"),
]
DE = [
    (1, -15, "D", "Joseph Arminio", "Sarah McBride", "", "", "McBride seeking a second term in the at large seat"),
]
# District polling, rebuilt 19 September 2026 after a full sweep of the fifty state Wikipedia pages with every
# numeric row independently re fetched before it counted. Every entry below is derived by one rule rather than
# entered by hand: drop a poll of a withdrawn candidate or a primary loser, a generic ballot row, a primary poll,
# and any survey at 20 percent undecided or more; drop a pre 2026 survey where the district also has a 2026 one;
# weight by a 45 day recency half life and by the square root of sample size floored at 400, times 0.7 for a
# partisan sponsored house; then move a sponsored poll 1.5 points off each candidate against its sponsor.
# The rule reproduces the previous hand entered values to a mean absolute 0.85 points of margin.
# Dropped from the old table: FL-7, which tested Cory Mills after he lost the primary and which the sweep could
# not verify at all, and FL-13, whose only survey sat at 20 percent undecided, the same bar that already excluded
# SC-7 and the April poll of KY-6. NY-17, NY-21, PA-7 and PA-10 have no rows on the state pages and are carried
# forward from Pollsmax unchanged.
POLLS = {
         "FL": {},
         "TX": {},
         "NYG": {17: dict(d=48.0, r=47.5), 21: dict(d=41.5, r=46.0)},
         "VA": {2: dict(d=45.5, r=48.5), 5: dict(d=42.5, r=48.5)},
         "CAG": {},
         "PAG": {1: dict(d=40.5, r=49.5), 7: dict(d=45.0, r=40.0), 8: dict(d=45.0, r=46.5), 10: dict(d=47.0, r=44.0)},
         "OH": {1: dict(d=47.0, r=43.0), 7: dict(d=46.1, r=40.3), 9: dict(d=44.5, r=45.5), 10: dict(d=40.1, r=50.1), 15: dict(d=36.6, r=44.0)},
         "NC": {1: dict(d=43.0, r=41.4), 3: dict(d=39.5, r=45.5), 7: dict(d=37.5, r=46.5), 10: dict(d=38.5, r=50.5)},
         "MI": {4: dict(d=45.9, r=46.5), 7: dict(d=44.5, r=46.5), 10: dict(d=42.5, r=43.5)},
         "GA": {},
         "IL": {},
         "NJ": {7: dict(d=45.5, r=44.5)},
         "WA": {3: dict(d=40.4, r=42.1), 5: dict(d=45.5, r=54.5)},
         "AZG": {2: dict(d=42.4, r=48.7), 6: dict(d=46.1, r=45.8)},
         "TN": {},
         "MA": {},
         "MO": {2: dict(d=39.5, r=45.5)},
         "MDG": {1: dict(d=37.5, r=53.5)},
         "MN": {1: dict(d=41.8, r=48.4)},
         "WIG": {1: dict(d=46.1, r=50.3), 3: dict(d=48.4, r=47.7)},
         "CO": {3: dict(d=41.1, r=45.9)},
         "IN": {5: dict(d=44.5, r=49.5)},
         "OR": {},
         "NVG": {2: dict(d=41.3, r=41.5)},
         "UT": {},
         "AK": {1: dict(d=39.1, r=48.8)},
         "HIG": {},
         "ID": {},
         "WY": {},
         "MT": {1: dict(d=42.2, r=46.7)},
         "ND": {},
         "SD": {},
         "NE": {1: dict(d=39.8, r=46.5)},
         "KS": {},
         "OK": {5: dict(d=41.5, r=49.5)},
         "NM": {2: dict(d=45.8, r=42.6)},
         "AR": {2: dict(d=47.6, r=44.1)},
         "IA": {1: dict(d=40.0, r=35.0), 2: dict(d=44.5, r=46.5), 3: dict(d=43.5, r=46.5)},
         "LA": {},
         "MS": {},
         "AL": {2: dict(d=44.7, r=47.9)},
         "SC": {1: dict(d=46.5, r=51.5)},
         "KY": {6: dict(d=43.0, r=46.1)},
         "WV": {},
         "CTG": {},
         "RI": {},
         "VTG": {1: dict(d=60.7, r=25.4)},
         "NH": {2: dict(d=50.0, r=37.3)},
         # UNH Sept 17-21 2026: ME-01 Pingree 57 Russell 35, ME-02 Dunlap 51 LePage 45. ME-02 blends
         # the new reading at 0.6 against the prior entry of unknown vintage, because it is both the
         # newest and from the largest sample; ME-01 had no entry, so it takes the poll outright.
         "ME": {1: dict(d=57.0, r=35.0), 2: dict(d=49.0, r=46.6)},
         "DE": {}}
UNCONTESTED = {"FL": {10: "D"}, "TX": {}, "NYG": {}, "VA": {}, "CAG": {}, "PAG": {},
               "OH": {}, "NC": {}, "MI": {}, "GA": {}, "IL": {}, "NJ": {}, "WA": {},
               "AZG": {}, "TN": {}, "MA": {}, "MO": {}, "MDG": {}, "MN": {}, "WIG": {}, "CO": {}, "IN": {},
         "OR": {}, "NVG": {}, "UT": {}, "AK": {}, "HIG": {}, "ID": {}, "WY": {},
         "MT": {}, "ND": {}, "SD": {}, "NE": {}, "KS": {}, "OK": {},
         "NM": {}, "AR": {}, "IA": {}, "LA": {}, "MS": {}, "AL": {}, "SC": {}, "KY": {}, "WV": {},
         "CTG": {}, "RI": {}, "VTG": {}, "NH": {}, "ME": {}, "DE": {}}
# where a named independent is polling well enough that the flat 1.5 percent third share would understate the field
THIRD_OVERRIDE = {"IA": {1: 0.07}}
COLS = ["district", "margin24", "inc", "rep", "dem", "third", "third_party", "note"]

# district spine. "p24" is the 2024 presidential lean alone, the original spine.
# "pvi" places every district at twice its Cook style PVI, the margin it would post in a tied national
# popular vote, and lets the state level shift carry it from there. "avg" splits the two in logit space.
SPINE = os.environ.get("SPINE", "p24")
_pv = {}
for _ln in open("/tmp/pvi/pvi.csv").read().strip().split("\n")[1:]:
    _f = _ln.split(",")
    _pv[(_f[1], int(_f[2]))] = (float(_f[8]), int(_f[5]))
PVI_SPINE = _pv

# district primary participation. The part of a district's share of its state's primary vote that
# its own partisan lean does not already explain, residualised within state so it redistributes
# rather than moving the state level. Token primaries, where one side drew under 40 percent of that
# party's state median, are excluded as filing accidents rather than signal, and the term is capped
# at two standard deviations. K matches Senate Mode's own primary party coefficient.
K_PRIMARY_PARTY = 0.30 if os.environ.get("NO_RECENCY") else 0.33
PRIMARY_TERM = json.load(open("/tmp/pvi/house_primary_term.json"))

# Measured ticket splitting. Where the same candidate who ran in 2024 is running again on lines
# that did not move, the district carries its own 2024 House versus presidential gap, at the
# carry measured on 192 districts: 0.612 for a gap of 2 points or more, 0.206 below that, where
# the gap is mostly one cycle's noise. This replaces the flat 2 and 3 point candidate bonus in
# those districts, because a guess is not needed once the thing itself has been measured.
TICKET_TERM = json.load(open("/tmp/pvi/house_ticket_term.json"))
try:
    HOUSE_FINANCE = json.load(open(os.environ.get("HOUSE_FINANCE", "/tmp/pvi/house_finance.json")))
except Exception:
    HOUSE_FINANCE = {}
K_FINANCE_HOUSE = float(os.environ.get("K_FINANCE_HOUSE", "0.03"))
INC_PTS, REDRAWN_PTS, CROSSOVER_PTS = 2.0, 3.0, 3.0

model = sm.fit_respondents()
shift, nat, nat_turn = sm.national_shift(model)
nat_swing = logit(sm.NAT_D2) - logit(sm.NAT_2024_D2)

def run(st, table, slug, name):
    df = pd.DataFrame(table, columns=COLS)
    df["d2_24"] = 0.5 - df.margin24 / 200.0
    df["d2_pvi"] = [PVI_SPINE[(st[:2], int(d))][0] for d in df.district]
    df["pvi_imputed"] = [PVI_SPINE[(st[:2], int(d))][1] for d in df.district]
    if SPINE == "pvi":
        df["d2_spine"] = df.d2_pvi
    elif SPINE == "avg":
        df["d2_spine"] = inv(0.5 * (logit(df.d2_24.values) + logit(df.d2_pvi.values)))
    elif SPINE == "pvi_real":
        # a state whose 2020 result was never recast onto its 2026 lines has no second cycle to average,
        # so PVI there would be the 2024 lean wearing a different constant. Those states keep the 2024 spine.
        df["d2_spine"] = np.where(df.pvi_imputed.values == 1, df.d2_24.values, df.d2_pvi.values)
    else:
        df["d2_spine"] = df.d2_24
    unc = UNCONTESTED[st]
    same = SAMEPARTY.get(st, {})            # top two produced a one party general; the seat is settled, the split is not
    def cand_points(r):
        if r.district in unc or r.district in same: return 0.0
        if r.inc == "D*": return CROSSOVER_PTS
        if r.inc == "R*": return -CROSSOVER_PTS
        if r.inc == "D": return CROSSOVER_PTS if r.margin24 > 0 else INC_PTS
        if r.inc == "R": return -(CROSSOVER_PTS if r.margin24 < 0 else INC_PTS)
        return 0.0
    df["cand_pts"] = df.apply(cand_points, axis=1)

    fl = sm.county_list(st)
    F16, F20, F24 = sm.pres_frames(st)          # Alaska's boroughs need their own frames
    P24 = F24.reindex(fl); w24 = P24.total_votes.values
    d2c = (P24.votes_dem / (P24.votes_dem + P24.votes_gop)).values
    state_d2_24 = float(P24.votes_dem.sum() / (P24.votes_dem + P24.votes_gop).sum())

    r_ = sm.RESP
    ct = pd.crosstab(r_.trump_approve_2way, r_.generic_ballot, values=r_.turnout_propensity, aggfunc="sum", normalize="index")
    app, dis, noop, cal = sm.calibrated_approval(fl)
    Dv = dis * ct.loc["Disapprove", "Democrat"] + app * ct.loc["Approve", "Democrat"] + noop * ct.loc["Neutral", "Democrat"]
    Rv = dis * ct.loc["Disapprove", "Republican"] + app * ct.loc["Approve", "Republican"] + noop * ct.loc["Neutral", "Republican"]
    M1 = float(((Dv / (Dv + Rv)).values * w24).sum() / w24.sum())

    reg = model["state_region"][st[:2]]
    comps = sm.census_components(model, fl, lambda f: reg)
    g26, turn_idx, adults = sm.census_predict(model, fl, lambda f: reg, shift[0], comps)
    g24, _, _ = sm.census_predict(model, fl, lambda f: reg, shift[1], comps, use24=True)
    M2 = float((inv(logit(d2c) + (logit(g26) - logit(g24))) * w24).sum() / w24.sum())
    M3 = float(inv(logit(state_d2_24) + nat_swing))
    # audit option. M1 regresses on the state's own 2024 presidential share at slope 0.659, so it
    # shrinks every state a third of the way to the national mean rather than measuring it. Setting
    # M1FIX restores unit slope about the national level, keeping M1's own residual intact.
    if os.environ.get("NO_M1FIX") is None:
        NAT24 = 0.4925                      # national 2024 two party Democratic share
        M1 = M1 + (1.0 - 0.659) * (state_d2_24 - NAT24)
    LEVEL = sm.W_FUND * M1 + sm.W_CENSUS * M2 + sm.W_HIST * M3

    # state projected House votes, the Senate Mode turnout anchor
    m22, t18 = sm.midterm_totals(st)
    sp = lambda P: P.reindex(fl).total_votes.sum()
    nat_ratio = np.mean([v / {2016: 136_669_276, 2020: 158_429_631}[py] for v, py in sm.NAT_MIDTERM.values()])
    st_factor = np.mean([(t18 / sp(F16)) / (sm.NAT_MIDTERM[2018][0] / 136_669_276),
                         (m22.sum() / sp(F20)) / (sm.NAT_MIDTERM[2022][0] / 158_429_631)])
    state_votes = float(sp(F24) * nat_ratio * st_factor)

    tshare = 1.0 - 0.30 * (df.d2_24.values - state_d2_24)
    tshare = tshare / tshare.sum()
    df["prim_term"] = [PRIMARY_TERM.get("%s-%02d" % (st[:2], int(d)), 0.0) for d in df.district]
    df["ticket_term"] = [TICKET_TERM.get("%s-%02d" % (st[:2], int(d)), 0.0) for d in df.district]
    # where the gap is measured, the flat bonus is switched off rather than stacked on top of it
    df.loc[df.ticket_term != 0.0, "cand_pts"] = 0.0
    base = (logit(df.d2_spine.values) + df.cand_pts.values / 200.0 * 4.0
            + (0.0 if os.environ.get("NO_PRIMARY") else K_PRIMARY_PARTY * df.prim_term.values)
            + (0.0 if os.environ.get("NO_TICKET") else df.ticket_term.values))
    def level_shift(target):
        lo, hi = -3.0, 3.0
        for _ in range(80):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if float((inv(base + mid) * tshare).sum()) < target else (lo, mid)
        return (lo + hi) / 2
    # campaign money: each side's FEC resources (raised, outside spending for it and against its opponent, coordinated
    # party spending) against the district's 2024 lean, through the same finance term as the Senate, applied to the
    # fundamentals and census share of the blend and added after the state level is set, so money moves the state too
    fin = np.zeros(len(df))
    for j, r in enumerate(df.itertuples()):
        key = "%s-%02d" % (st[:2], int(r.district))
        sh_, why_ = sm.finance_term(key, 0, float(r.d2_24), book=HOUSE_FINANCE, k=K_FINANCE_HOUSE, max_polls=999)
        fin[j] = sh_ * (sm.W_FUND + sm.W_CENSUS)
    df["finance_term"] = fin
    df["model_d2"] = inv(base + level_shift(LEVEL) + fin)

    df["poll_d2"] = np.nan
    for i, r in df.iterrows():
        p = POLLS[st].get(r.district)
        if p: df.loc[i, "poll_d2"] = p["d"] / (p["d"] + p["r"])
    df["final_d2"] = np.where(df.poll_d2.notna(), 0.5 * df.model_d2 + 0.5 * df.poll_d2.fillna(0), df.model_d2)
    df["third_share"] = np.where(df.third.astype(bool), 0.015, 0.0)
    for dnum, share in THIRD_OVERRIDE.get(st, {}).items():
        df.loc[df.index[df.district == dnum][0], "third_share"] = share
    df["dem_pct"] = 100 * df.final_d2 * (1 - df.third_share)
    df["rep_pct"] = 100 * (1 - df.final_d2) * (1 - df.third_share)
    df["third_pct"] = 100 * df.third_share
    for dnum, party in unc.items():
        i = df.index[df.district == dnum][0]
        df.loc[i, ["dem_pct", "rep_pct", "third_pct"]] = (100.0, 0.0, 0.0) if party == "D" else (0.0, 100.0, 0.0)
    df["margin"] = df.dem_pct - df.rep_pct
    df["fixed"] = [same.get(d, "") for d in df.district]
    for dnum, party in same.items():        # no two party split exists to report, only the party that holds the seat
        i = df.index[df.district == dnum][0]
        df.loc[i, ["dem_pct", "rep_pct", "third_pct", "margin"]] = np.nan

    # projected vote totals
    df["projected_votes"] = (state_votes * tshare).round(0)
    for c in ["dem", "rep", "third"]:
        df[f"{c}_votes"] = (df.projected_votes * df[f"{c}_pct"] / 100).round(0)   # NaN where the split is unknown

    def rating(m):
        a = abs(m)
        return ("Tilt " if a < 2 else "Lean " if a < 6 else "Likely " if a < 12 else "Safe ") + ("D" if m > 0 else "R")
    df["rating"] = df.margin.map(lambda m: rating(m) if pd.notna(m) else "")
    df.loc[df.fixed != "", "rating"] = df.loc[df.fixed != "", "fixed"].map({"D": "D hold", "R": "R hold"})

    rng = np.random.default_rng(2026)
    N = 10000
    marg = df.margin.values[None, :] + rng.normal(0, 3.0, N)[:, None] + rng.normal(0, 2.5, (N, len(df)))
    for dnum in unc: marg[:, df.index[df.district == dnum][0]] = 100
    for dnum, party in same.items(): marg[:, df.index[df.district == dnum][0]] = 100 if party == "D" else -100
    dseats = (marg > 0).sum(axis=1)
    df["dem_win_prob"] = 100 * (marg > 0).mean(axis=0)

    sens = []
    stw2 = 100 * (2 * LEVEL - 1)                       # the projected statewide two party margin
    step = 2 if abs(stw2) < 8 else 5                    # a lopsided state needs a wider grid to show anything
    for env in [round(stw2 + step * k, 1) for k in (4, 3, 2, 1, 0, -1, -2, -3)]:
        m = 100 * (2 * inv(base + level_shift(0.5 + env / 200.0)) - 1)
        for dnum in unc: m[df.index[df.district == dnum][0]] = 100
        for dnum, party in same.items(): m[df.index[df.district == dnum][0]] = 100 if party == "D" else -100
        sens.append(dict(statewide_margin=env, dem_seats=int((m > 0).sum()), rep_seats=int((m < 0).sum())))

    # flip point for each district
    grid = np.arange(min(-12.0, stw2 - 30), max(16.0, stw2 + 20) + 0.01, 0.25)
    curves = np.array([100 * (2 * inv(base + level_shift(0.5 + e / 200.0)) - 1) for e in grid])
    df["flip"] = [None if df.fixed.iloc[i] else (float(grid[np.argmax(curves[:, i] > 0)]) if (curves[:, i] > 0).any() else None)
                  for i in range(len(df))]

    summary = dict(state=name, abbr=st, districts=len(df),
                   components=dict(M1=100 * M1, M2=100 * M2, M3=100 * M3, blend=100 * LEVEL),
                   state_2024_d2=100 * state_d2_24, spine=SPINE,
                   districts_with_primary_term=int((df.prim_term != 0).sum()),
                   districts_with_ticket_term=int((df.ticket_term != 0).sum()),
                   statewide_house_margin=100 * (2 * LEVEL - 1),        # the partisan level the blend solved for
                   contested_margin=float((df.margin.fillna(0) * tshare).sum() / tshare[df.margin.notna().values].sum()),
                   state_votes=int(df.projected_votes.sum()),
                   dem_votes=int(df.dem_votes.sum()), rep_votes=int(df.rep_votes.sum()),
                   dem_seats_point=int((df.margin > 0).sum() + sum(1 for p in same.values() if p == "D")),
                   rep_seats_point=int((df.margin < 0).sum() + sum(1 for p in same.values() if p == "R")),
                   same_party={str(k): v for k, v in same.items()},
                   simulation=dict(mean_dem_seats=float(dseats.mean()), median_dem_seats=float(np.median(dseats)),
                                   dist={int(k): int(v) for k, v in zip(*np.unique(dseats, return_counts=True))}),
                   sensitivity=sens, national_generic_d2=100 * sm.NAT_D2)
    df.to_csv(f"{OUT}/{slug}_2026_house_district_forecast.csv", index=False)
    json.dump(summary, open(f"{OUT}/{slug}_house_run_summary.json", "w"), indent=1)
    print(name, summary["dem_seats_point"], "D /", summary["rep_seats_point"], "R",
          "statewide", round(summary["statewide_house_margin"], 2),
          "votes", f"{summary['state_votes']:,}", "components", {k: round(v, 2) for k, v in summary["components"].items()})
    print(df[["district", "margin24", "dem_pct", "rep_pct", "margin", "rating", "dem_win_prob", "projected_votes"]].round(1).to_string(index=False))
    return df, summary

run("FL", FL, "florida", "Florida")
run("TX", TX, "texas", "Texas")
run("NYG", NY, "new_york", "New York")
run("VA", VA, "virginia", "Virginia")
run("CAG", CA, "california", "California")
run("PAG", PA, "pennsylvania", "Pennsylvania")
run("OH", OH, "ohio", "Ohio")
run("NC", NC, "north_carolina", "North Carolina")
run("MI", MI, "michigan", "Michigan")
run("GA", GA, "georgia", "Georgia")
run("IL", IL, "illinois", "Illinois")
run("NJ", NJ, "new_jersey", "New Jersey")
run("WA", WA, "washington", "Washington")
run("AZG", AZ, "arizona", "Arizona")
run("TN", TN, "tennessee", "Tennessee")
run("MA", MA, "massachusetts", "Massachusetts")
run("MO", MO, "missouri", "Missouri")
run("MDG", MD, "maryland", "Maryland")
run("MN", MN, "minnesota", "Minnesota")
run("WIG", WI, "wisconsin", "Wisconsin")
run("CO", CO, "colorado", "Colorado")
run("IN", IN, "indiana", "Indiana")
run("OR", OR, "oregon", "Oregon")
run("NVG", NV, "nevada", "Nevada")
run("UT", UT, "utah", "Utah")
run("AK", AK, "alaska", "Alaska")
run("HIG", HI, "hawaii", "Hawaii")
run("ID", ID, "idaho", "Idaho")
run("WY", WY, "wyoming", "Wyoming")
run("MT", MT, "montana", "Montana")
run("ND", ND, "north_dakota", "North Dakota")
run("SD", SD, "south_dakota", "South Dakota")
run("NE", NE, "nebraska", "Nebraska")
run("KS", KS, "kansas", "Kansas")
run("OK", OK, "oklahoma", "Oklahoma")
run("NM", NM, "new_mexico", "New Mexico")
run("AR", AR, "arkansas", "Arkansas")
run("IA", IA, "iowa", "Iowa")
run("LA", LA, "louisiana", "Louisiana")
run("MS", MS, "mississippi", "Mississippi")
run("AL", AL, "alabama", "Alabama")
run("SC", SC, "south_carolina", "South Carolina")
run("KY", KY, "kentucky", "Kentucky")
run("WV", WV, "west_virginia", "West Virginia")
run("CTG", CT, "connecticut", "Connecticut")
run("RI", RI, "rhode_island", "Rhode Island")
run("VTG", VT, "vermont", "Vermont")
run("NH", NH, "new_hampshire", "New Hampshire")
run("ME", ME, "maine", "Maine")
run("DE", DE, "delaware", "Delaware")
