var SerialPort = require("browser-serialport");
var intel_hex = require('intel-hex');
var stk500 = require('stk500');
var async = require("async");

var usbttyRE = /(cu\.usb|ttyACM|COM\d+)/;

var data = ":100000000C9465000C948D000C948D000C948D0064\n:100010000C948D000C948D000C948D000C948D002C\n:100020000C948D000C948D000C948D000C94CD08D4\n:100030000C948D000C948D000C948D000C948D000C\n:100040000C94B3110C948D000C94BD130C940F14EC\n:100050000C948D000C948D000C948D000C948D00EC\n:100060000C94290B0C948D00000000002400270044\n:100070002A0000000000250028002B0000000000DE\n:1000800023002600290004040404040404040202DA\n:100090000202020203030303030301020408102007\n:1000A0004080010204081020010204081020000012\n:1000B0000007000201000003040600000000000029\n:1000C00000007401C509550E7E1511241FBECFEF27\n:1000D000D8E0DEBFCDBF11E0A0E0B1E0E0EEFDE290\n:1000E00002C005900D92A03EB107D9F714E0A0EE32\n:1000F000B1E001C01D92A636B107E1F710E0CAECED\n:10010000D0E004C02297FE010E94EA16C23CD1074B\n:10011000C9F70E94D5150C94EE160C940000FB0153\n:10012000DC014150504048F001900D920020C9F789\n:1001300001C01D9241505040E0F70895FC0181E05C\n:1001400090E00190061609F4CF010020D1F7019745\n:100150000895FB0151915523A9F0BF01DC014D9198\n:1001600045174111E1F759F4CD010190002049F004\n:100170004D9140154111C9F3FB014111EFCF81E0D1\n:1001800090E0019708950F931F93CF93DF93B82FBB\n:10019000833008F075C090E00196A82FAA0FAA0F2F\n:1001A000AA0F0197A53108F0A4E1482F440F440F8E\n:1001B000440F71E050E0C62FD0E001E010E01EC017\n:1001C000842F82508231C0F4242F30E0F901E851AD\n:1001D000FE4F8081823080F4572BF901EE0FFF1F14\n:1001E000E150FE4F11821082872F90E08C239D23D7\n:1001F000892B11F011830083770F4F5F4A1700F3AB\n:10020000BB2361F4852F8C7FF8942BB1982F9095A8\n:1002100092238623982B9BB9789432C0B13009F58C\n:10022000F89495B1852F8F7380958923962F9F73AE\n:100230009523892B85B948B1252F30E0862F90E092\n:100240002823392386E0359527958A95E1F752953D\n:1002500056955695537050955423522B58B978940F\n:100260000FC0852F8F70F89428B1982F990F990F90\n:10027000909592238623880F880F982B98B97894AD\n:10028000DF91CF911F910F910895482F863018F577\n:100290002091E0013091E101672B81F481E090E051\n:1002A00002C0880F991F4A95E2F780959095282300\n:1002B00039233093E1012093E001089581E090E03B\n:1002C00002C0880F991F4A95E2F7282B392B3093EB\n:1002D000E1012093E0010895833028F4E82FF0E055\n:1002E000EE51FE4F60830895CF93DF93CAE6D2E0CC\n:1002F000CE010E944707239682E0CE38D807C1F787\n:10030000DF91CF9108950F931F93CF93DF938B01CC\n:10031000843178F5C82FD0E0FE01E851FE4FE0812E\n:10032000E33091F0E43029F582508C30E0F49E0106\n:1003300022503040C901880F991F820F931F8659A0\n:100340009D4F0E94DF070FC0833051F0853041F090\n:10035000863031F0893021F08A3011F08B3019F479\n:10036000B8010E94C912CC0FDD1FC150DE4F1983A6\n:100370000883DF91CF911F910F910895AF92BF92A3\n:10038000DF92EF92FF920F931F93DF93CF930F9221\n:10039000CDB7DEB7D82E7B01082F10E0F801E85169\n:1003A000FE4F8081863061F480916702882341F09E\n:1003B0006630710529F0109267028FEF8093B801C3\n:1003C0009D2D925099839C30B8F4E4E0EE16F10430\n:1003D00099F0C80102975C01AA0CBB1CA80EB91EBB\n:1003E0008AE692E0A80EB91EC5010E94CD078823B7\n:1003F00019F0C5010E9461074D2D4E504630B8F4EA\n:100400002091E0013091E10192E0E916F10409F058\n:10041000E0C081E090E0042E02C0880F991F0A948A\n:10042000E2F7282B392B3093E1012093E001E98199\n:10043000E23130F5ED2DE695E695E69598012770C9\n:100440003070E114F10471F4F0E0E450FE4F81E00B\n:1004500090E002C0880F991F2A95E2F72081282B8F\n:1004600020830EC0F0E0E450FE4F81E090E002C037\n:10047000880F991F2A95E2F7809520818223808337\n:10048000F801EE0FFF1FE150FE4F11821082F2E0E3\n:10049000EF16F104E1F083E0E816F1044CF4E11406\n:1004A000F10439F191E0E916F10409F08BC032C092\n:1004B000E4E0EE16F10409F45DC0F4E0EF16F10497\n:1004C000CCF186E0E816F10409F07CC070C046303B\n:1004D00008F08CC09981923140F48D2D60E00E942B\n:1004E00029138D2D60E00E94681308511E4F82E091\n:1004F00066C0F981F23108F079C08D2D60E00E946C\n:1005000029138D2D60E00E94681308511E4FF801D9\n:1005100010826CC0F981F23108F068C08D2D60E066\n:100520000E9468138D2D61E00E94291308511E4F0F\n:1005300081E045C0F3E0DF1681F085E0D81669F070\n:1005400096E0D91651F0E9E0DE1639F0FAE0DF1650\n:1005500021F08BE0D81609F049C08D2D61E00E9492\n:1005600029138D2D60E070E00E94C91208511E4FC2\n:1005700083E025C0F981FC30C8F5F801E851FE4F51\n:1005800084E08083C80102977C01EE0CFF1CE80E1A\n:10059000F91E8AE692E0E80EF91EC7010E94CD0717\n:1005A000882321F5C701B8010E94C6081FC09EEE2E\n:1005B000D90EE1E0ED15D0F008511E4F86E0F801AC\n:1005C000808314C084E793E060E071E00E94E00E55\n:1005D0000DC081E090E0042E02C0880F991F0A949C\n:1005E000E2F780959095282339231DCF0F90CF9166\n:1005F000DF911F910F91FF90EF90DF90BF90AF9030\n:1006000008951F9380916702882329F01092670252\n:100610008FEF8093B8011092E2011092FC011092CA\n:10062000E5011092E3011092FD011092E601109293\n:10063000E4011092FE011092E70110E0812F8E502C\n:10064000863020F4812F62E070E003C0812F61E0EA\n:1006500070E00E94BE011F5F143181F71092E1012A\n:100660001092E0011F9108950F931F9304E713E088\n:10067000C80161E171E042E023E00E94DB0FC801A4\n:1006800060EE43E851E00E940F0EC80160E943ECC0\n:1006900050E00E940F0EC80160EC45E451E00E945A\n:1006A0000F0EC80160ED4CE651E00E940F0EC8012C\n:1006B00064EF4EEB51E00E940F0EC80160EF4CED6D\n:1006C00054E00E94330EC8016FEF41E053E00E94F6\n:1006D0002D0EC80140E051EE60E070E00E944A102B\n:1006E0000E9401031F910F9108951F9310E0812F25\n:1006F0008251823028F4812F66E070E00E94BE01B2\n:100700001F5F1431A1F781E0809367028AEF92E0C6\n:100710000E94650A1F9108951F93CF93DF93282F9E\n:10072000162FC82FD0E0FE01E450FE4F8081182321\n:10073000442331F4FE01EB51FE4F8081811751F0CB\n:1007400084E793E0622F412F50E00E94AA0DCB5125\n:10075000DE4F1883DF91CF911F9108958091E201C0\n:10076000882349F069B18091FC0168236C7F80E0A7\n:1007700040E00E948C038091E301882379F083B1EB\n:1007800066B16295660F660F607C8F73682B8091EF\n:10079000FD01682381E040E00E948C038091E40128\n:1007A000882379F086B190E08C7390709595879549\n:1007B000959587956091FE01682382E040E00E9454\n:1007C0008C030895EF92FF920F931F93CF93DF93C3\n:1007D000F82EEB01E42E8FEF6F3F780719F4C0E09D\n:1007E000D0E014C08AEF92E06F2D0E948B098AEF4F\n:1007F00092E06C2F0E940D0A8AEF92E00E94500A4C\n:1008000080916802909169020E9462128AEF92E0E0\n:100810006F2D4E2D0E94610A0E2D10E08AEF92E09E\n:100820000E9495090817190791F4F0924702C093A6\n:100830004802C9E4D2E00C0F1D1F05C08AEF92E008\n:100840000E949E098993C017D107C1F712C08AEF91\n:1008500092E00E949509801791072CF484E793E0B9\n:1008600065E271E004C084E793E06DE471E00E940A\n:10087000E00E82E0E80E84E793E067E74E2D27E480\n:1008800032E00E94DC0DDF91CF911F910F91FF901C\n:10089000EF900895AF92BF92CF92DF92EF92FF92C6\n:1008A0000F931F93CF93DF930E94AE0304C084E79E\n:1008B00093E00E942C0F84E793E00E94830D892B24\n:1008C000B1F70E94FB116093270270932802809376\n:1008D000290290932A02A0902B02B0902C02C09083\n:1008E0002D02D0902E022091B6013091B7017901EE\n:1008F0000027F7FC0095102F6A197B098C099D09C8\n:10090000E616F7060807190708F04BC0EA0CFB1CAF\n:100910000C1D1D1DE0922B02F0922C0200932D0263\n:1009200010932E02C8EED1E012EF1630C0F4888189\n:100930008230A9F48091E0019091E101012E02C082\n:10094000959587950A94E2F780FF09C0812F0E9450\n:10095000A712AC0184E793E0612F0E948F0D1F5F07\n:100960002196163011F78091B80187FD1AC010E06A\n:100970000EC0F901EE0FFF1FE20FF31FE15DFD4F07\n:100980006181808170E042810E94E2031F5F212F1C\n:1009900030E08091B801992787FD909582179307E1\n:1009A00044F7DF91CF911F910F91FF90EF90DF906F\n:1009B000CF90BF90AF900895BF92CF92DF92EF9209\n:1009C000FF920F931F93CF93DF93162FEA018F3679\n:1009D00009F44FC1803750F48B3609F46AC18D3663\n:1009E00009F4D3C1893609F048C228C2863769F0B4\n:1009F000873720F4803709F040C2E4C0883709F413\n:100A0000C7C08A3709F039C219C1898185FF05C07D\n:100A100084E793E064E771E054C0688188718830AE\n:100A200059F1893018F4882341F027C2803109F444\n:100A300040C0883109F021C264C08AEF92E00E9470\n:100A40008B0902E00EC0FE01E00FF11D6181679588\n:100A5000662767958081680F8AEF92E00E940D0AF1\n:100A60000E5F011780F38AEF92E00E94500A86E43D\n:100A700090E00E94621201C29B818A81163071F45B\n:100A8000979599279795980F4D81479544274795B6\n:100A90008C81480F862F692F70E008C097959927A1\n:100AA0009795980F862F6FEF7FEF492F0E94E203F3\n:100AB000E4C18091B80187303CF084E793E060EABC\n:100AC00071E00E94E00ED9C18F5F8093B801992731\n:100AD00087FD9095FC01EE0FFF1FE80FF91FE15D08\n:100AE000FD4F60838B818795882787959A81890F31\n:100AF00081838D818795882787959C81890F828343\n:100B0000BCC15091B801151634F420E0C52FDD2783\n:100B1000C7FDD09511C08FEF8093B801AEC1FC0125\n:100B2000EE0FFF1FE80FF91FE15DFD4F60836623A5\n:100B300011F0422F24C02F5F822F90E0C817D907F1\n:100B400074F740E01CC04830C8F4C9010196D901CF\n:100B5000AA0FBB1FA20FB31FA15DBD4FFC01EE0F7B\n:100B6000FF1FE80FF91FE15DFD4F80818C938081AD\n:100B700011968C931197828112968C934F5F242F3C\n:100B800030E0C217D307FCF651505093B80175C13D\n:100B90008981682F70E07695762F6627779567951F\n:100BA0008881680F711D6115710521F070936902CC\n:100BB0006093680280916702882309F05EC10E94F9\n:100BC00075035BC1653008F458C1F880C980EA80BC\n:100BD000BB80DC808F2D82508C3008F04EC10F2DF1\n:100BE00010E0C8010297EC01CC0FDD1FC80FD91F20\n:100BF000C659DD4FCE010E94CD07882319F0CE01E2\n:100C00000E9461074E2D50E05695542F442757956A\n:100C100047954C0D511D2D2D30E03695322F222752\n:100C2000379527952B0D311DCE01B8010E9447083D\n:100C30008F2D64E070E00E94BE011FC1623008F495\n:100C40001CC1898190E09695982F88279795879564\n:100C50002881820F911D9093B7018093B6010A9766\n:100C60000CF00BC18AE090E09093B7018093B6013D\n:100C700004C1623008F401C18981682F70E012302C\n:100C8000A1F08A8190E09695982F8827979587956F\n:100C9000682B792B133049F02B81922F9295990F65\n:100CA000990F907C80E0682B792B88810E948301CA\n:100CB000E4C080E494E060EF0E943E1580E494E09C\n:100CC0006CE60E943E1500E01EEF16C01231A0F443\n:100CD00080E494E060E00E943E1580E494E061E0EE\n:100CE0000E943E1580E494E061E00E943E1580E49D\n:100CF00094E061E00E943E15802F8E50863050F4C3\n:100D000080E494E062E00E943E1580E494E06AE0B2\n:100D10000E943E15033051F0053041F0063031F0AD\n:100D2000093021F00A3011F00B3051F480E494E0E6\n:100D300063E00E943E1580E494E068E00E943E1566\n:100D40001C3050F480E494E064E00E943E1580E49E\n:100D500094E06EE00E943E15802F8251823050F464\n:100D600080E494E066E00E943E1580E494E061E057\n:100D70000E943E1580E494E06FE70E943E150F5FED\n:100D80001F5F043109F0A2CF73C0662309F475C058\n:100D9000088180E494E060EF0E943E1580E494E0D6\n:100DA0006EE60E943E1580E494E0602F0E943E159E\n:100DB000043108F05DC0C02FD0E0FE01E851FE4FC5\n:100DC00080E494E060810E943E158E01000F111FA7\n:100DD00001501E4FF801608170E06F77707080E401\n:100DE00094E00E943E15F80160817181CB0180780A\n:100DF000892B59F0660F672F661F770B70E06F77AE\n:100E0000707080E494E00E943E15CC0FDD1FC1504D\n:100E1000DE4F28813981C9018070907C892B41F196\n:100E2000330F220B330F322F221F622F70E06F77A8\n:100E3000707080E494E00E943E151AC080E494E053\n:100E400060EF0E943E1580E494E06AE60E943E1541\n:100E5000C2EFDFEFC63018F06FE770E001C0BE01EF\n:100E600080E494E00E943E152196C630D10591F7AA\n:100E700080E494E067EF0E943E15DF91CF911F91CF\n:100E80000F91FF90EF90DF90CF90BF900895FC01FD\n:100E900080918E028C3090F480838F5F80938E02DD\n:100EA000815090E0FC01EE0FFF1FE80FF91FE157A2\n:100EB000FD4F88EB9BE09283818308958FEF8083C1\n:100EC0000895DC018C9190E0FC01EE0FFF1FE80F0C\n:100ED000F91FE157FD4F80818F7B80838C916CE0FF\n:100EE0000E94781690E0AC01440F551F480F591F1F\n:100EF000440F551F440F551F20E030E0C901840FF7\n:100F0000951FFC01EE0FFF1FE80FF91FE157FD4F82\n:100F1000808186FD05C02F5F3F4F2C30310571F772\n:100F20000895FC0120812C30B8F58181992787FD37\n:100F3000909548E850E0481B590B440F551F440F4B\n:100F4000551F6417750784F08281992787FD909556\n:100F500048E552E0481B590B440F551F440F551FDD\n:100F6000641775070CF4AB0142505040CA01AA2720\n:100F700097FDA095BA2F880F991FAA1FBB1F4FB7C7\n:100F8000F89430E0F901EE0FFF1FE20FF31FE15775\n:100F9000FD4F928381834FBF0895FC01808190E0D3\n:100FA000FC01EE0FFF1FE80FF91FE157FD4F808195\n:100FB000829586958695817009F081E00895AF92BB\n:100FC000BF92CF92DF92EF92FF920F931F93CF9336\n:100FD000DF93EC019B0182E0603278070CF048C09F\n:100FE00077FF03C020E030E005C0653B710514F0D9\n:100FF00024EB30E000D000D0B901882777FD809540\n:10100000982F2981332727FD3095E8E8AE2EB12CA3\n:10101000A21AB30AAA0CBB1CAA0CBB1CCC24B7FC9A\n:10102000C094DC2CEA81FF27E7FDF09528E532E04B\n:101030002E1B3F0B220F331F220F331F442737FD78\n:101040004095542FEDB7FEB72183328343835483F9\n:1010500020E030E040E050E004EBE02EF12C012DE8\n:10106000112D0E9410169B010F900F900F900F9062\n:10107000CE01B9010E949107DF91CF911F910F918D\n:10108000FF90EF90DF90CF90BF90AF900895CF92F8\n:10109000DF92EF92FF921F93CF93DF93EC01162F15\n:1010A0007A01690188818C3008F064C0862F61E084\n:1010B0000E942913888190E0FC01EE0FFF1FE80FCA\n:1010C000F91FE157FD4F1F738081807C812B808346\n:1010D00080E292E08E199F0964E070E00E9484161D\n:1010E000698380E699E08C199D0964E070E00E94B4\n:1010F00084166A83A8818A2F6CE00E947816682F74\n:1011000070E0AB01440F551F460F571F440F551F8A\n:10111000440F551F20E030E0C901840F951FFC01EA\n:10112000EE0FFF1FE80FF91FE157FD4F808186FD8D\n:1011300015C02F5F3F4F2C30310571F724C010923E\n:10114000800082E0809381001092850010928400DC\n:10115000B19A80916F00826080936F008A2F90E037\n:10116000FC01EE0FFF1FE80FF91FE157FD4F8081D3\n:10117000806480838881DF91CF911F91FF90EF90F1\n:10118000DF90CF900895672BD1F2E8CF40E252E094\n:1011900020E639E00E94470808951F920F920FB68B\n:1011A0000F9211242F933F934F935F936F937F93ED\n:1011B0008F939F93AF93BF93EF93FF938091B3026D\n:1011C00087FF05C010928500109284002BC02091EB\n:1011D000B302332727FD309580918E0290E02817C7\n:1011E000390704F58091B302992787FD9095FC019A\n:1011F000EE0FFF1FE80FF91FE157FD4F808186FFBB\n:1012000011C08091B302992787FD9095FC01EE0FE4\n:10121000FF1FE80FF91FE157FD4F80818F7360E0DA\n:101220000E9468138091B3028F5F8093B302209174\n:10123000B302332727FD309580918E0290E0281766\n:1012400039070CF04EC08091B3028C300CF049C0CD\n:1012500020918400309185008091B302992787FD09\n:101260009095FC01EE0FFF1FE80FF91FE157FD4FAE\n:1012700081819281280F391F309389002093880043\n:101280008091B302992787FD9095FC01EE0FFF1F17\n:10129000E80FF91FE157FD4F808186FF2BC0809139\n:1012A000B302992787FD9095FC01EE0FFF1FE80F11\n:1012B000F91FE157FD4F80818F7361E00E94681331\n:1012C00019C080E49CE905C080918400909185005C\n:1012D000049690938900809388008FEF8093B302E7\n:1012E00009C08091840090918500049680549C49A7\n:1012F00040F3EACFFF91EF91BF91AF919F918F9112\n:101300007F916F915F914F913F912F910F900FBE01\n:101310000F901F90189581E08093F9026093D60298\n:101320001092F7021092F80208952091D50230E051\n:101330008091D402281B3109C90108954091D4023B\n:101340008091D502481718F02FEF3FEF0AC0E42F25\n:10135000F0E0EC54FD4F8081282F30E04F5F409348\n:10136000D402C9010895E091D4028091D502E81712\n:1013700018F0EFEFFFEF06C0F0E0EC54FD4F808176\n:10138000E82FF0E0CF01089508951092FD02109229\n:10139000FC0288EE93E0A0E0B0E08093FE02909320\n:1013A000FF02A0930003B093010384EC91E09093BB\n:1013B000FB028093FA020895CF92DF92EF92FF92A0\n:1013C0000F931F93CF93DF937C016B018A01809170\n:1013D000F9028823A1F0C0E0D0E00DC0D701ED9163\n:1013E000FC91D601AC0FBD1F0190F081E02DC7012B\n:1013F0006C9109952196C017D10780F304C0CB01E9\n:10140000642F0E940E0BC801DF91CF911F910F91A5\n:10141000FF90EF90DF90CF900895DF93CF930F92DE\n:10142000CDB7DEB7FC0169838091F9028823C9F04A\n:101430008091F802803238F081E090E093838283DB\n:1014400020E030E015C08091F702E82FF0E0E9528B\n:10145000FD4F998190838F5F8093F7028093F8020C\n:1014600005C0CE01019661E00E940E0B21E030E044\n:10147000C9010F90CF91DF9108950F93062F8091AE\n:10148000D60267ED72E04091F80221E00E94B90AAD\n:101490001092F7021092F8021092F9020F9108953B\n:1014A00061E00E943D0A0895413208F040E2862F33\n:1014B00064EB72E00E94700A1092D4028093D5020D\n:1014C000089521E00E94540A08951092D4021092C7\n:1014D000D5021092F7021092F8020E94BA0C0895F9\n:1014E000382F413210F040E042C08091060388233B\n:1014F000E1F791E090930603209308038FEF809328\n:10150000730310922E03415040932F034F5F90932B\n:10151000070380910703330F832B80930703809188\n:101520000903813041F410920903809107038093ED\n:10153000BB0085EC01C085EE8093BC008091060362\n:101540008130E1F380912E03841710F440912E0333\n:1015500020E030E00AC0FB01E20FF31FD901A25FD7\n:10156000BC4F8C9180832F5F3F4F2417A0F3842FB3\n:1015700008950F931F93582F122F413210F081E0DE\n:101580004AC0809106038823E1F782E08093060336\n:10159000009308038FEF8093730310922E03409300\n:1015A0002F03AEE0B3E0FB0102C081918D938E2F3B\n:1015B000861B8417D0F31092070380910703550F01\n:1015C000852B8093070380910903813041F41092A9\n:1015D0000903809107038093BB0085EC01C085EE71\n:1015E0008093BC00112321F0809106038230E1F347\n:1015F000809173038F3F11F480E00DC080917303DD\n:10160000803211F482E007C080917303803311F0BF\n:1016100084E001C083E01F910F910895482F61324B\n:1016200010F081E0089580910603843011F082E08B\n:10163000089560935103A0E3B3E0842F9C01F90166\n:1016400002C081918D938E2F841B8617D0F380E08A\n:1016500008951F920F920FB60F9211242F933F936C\n:101660004F935F936F937F938F939F93AF93BF93AA\n:10167000EF93FF938091B90090E0887F907080365F\n:10168000910509F4F2C081369105CCF588329105B7\n:1016900009F47BC089329105B4F48031910509F4D5\n:1016A0006FC0813191053CF4009709F447C1089758\n:1016B00009F04FC165C08831910509F466C0809773\n:1016C00009F047C182C08034910509F4A4C0813477\n:1016D000910544F48033910509F482C0C89709F05C\n:1016E00038C189C08035910509F489C088359105D4\n:1016F00009F496C08834910509F02BC1AEC0883931\n:10170000910509F413C189399105ECF488379105E5\n:1017100009F4ABC0893791054CF48836910509F47A\n:10172000A4C08037910509F014C19FC08838910585\n:1017300009F4FCC08039910509F49DC080389105F9\n:1017400009F007C198C0803B910509F4C6C0813BF0\n:1017500091054CF4803A910509F49FC0883A9105AF\n:1017600009F0F7C0BAC0803C910509F4E3C0883C99\n:10177000910509F4DFC0883B910509F0EAC0C2C0B9\n:10178000809107038093BB00CFC090912E0380917E\n:101790002F03981768F490912E03E92FF0E0E25F91\n:1017A000FC4F80818093BB009F5F90932E03BCC051\n:1017B00080910803882309F44BC085ED8093BC0019\n:1017C0008091BC0084FDFCCFC2C080E28093730393\n:1017D00085ED8093BC008091BC0084FDFCCFB7C038\n:1017E00080E38093730385ED8093BC008091BC00FF\n:1017F00084FDFCCFACC088E3809373039BC08091D1\n:101800002E039091BB00E82FF0E0E25FFC4F908345\n:101810008F5F80932E0390912E0380912F0382C0BF\n:1018200080912E039091BB00E82FF0E0E25FFC4F27\n:1018300090838F5F80932E0380910803882341F06B\n:1018400085ED8093BC008091BC0084FDFCCF7FC0FF\n:1018500081E08093090384EA6EC085ED8093BC002B\n:101860008091BC0084FDFCCF72C083E080930603AE\n:101870001092720359C080917203803208F056C0F2\n:10188000809172039091BB00E82FF0E0EE5AFC4F7C\n:1018900090838F5F8093720347C080917203803280\n:1018A00030F4E0917203F0E0EE5AFC4F108285EDC7\n:1018B0008093BC008091BC0084FDFCCF1092060395\n:1018C00060917203E0910C03F0910D0382E593E0C7\n:1018D00070E00995109272032DC084E08093060396\n:1018E0001092500310925103E0910A03F0910B0300\n:1018F000099580915103882329F481E08093510355\n:101900001092300390915003E92FF0E0E05DFC4F1E\n:1019100080818093BB009F5F909350039091500310\n:1019200080915103981710F485EC01C085E88093ED\n:10193000BC000FC085EC8093BC0009C010927303FB\n:1019400085ED8093BC008091BC0084FDFCCF10929B\n:101950000603FF91EF91BF91AF919F918F917F917E\n:101960006F915F914F913F912F910F900FBE0F900C\n:101970001F9018951092060381E08093080310923F\n:10198000090382E161E00E94681383E161E00E9443\n:101990006813E9EBF0E080818E7F808380818D7F0A\n:1019A000808388E48093B80085E48093BC00089528\n:1019B000EF92FF920F931F937C018B01DC01ED915D\n:1019C000FC91A081B1816F772D913C91CF01F901FC\n:1019D0000995D701ED91FC91A081B181000F012FF4\n:1019E000001F110B0F772D913C91CF01602FF90152\n:1019F00009951F910F91FF90EF900895FC010190C0\n:101A0000F081E02DA081B1812D913C91CF0160EF5B\n:101A1000F90109950895FC010190F081E02DA08164\n:101A2000B1812D913C91CF0167EFF901099508959E\n:101A30000F931F938C01DC01ED91FC91A081B1818A\n:101A40002D913C91CF0169EFF9010995D801ED91F4\n:101A5000FC91A081B1812D913C91CF0162E0F9010F\n:101A60000995D801ED91FC91A081B1812D913C9116\n:101A7000CF0163E0F90109951F910F9108951F931C\n:101A8000CF93DF93EC018A818823C9F1CE010E94B4\n:101A9000FE0CE881F981A081B1812D913C91CF01AB\n:101AA00069E7F9010995E881F981A081B1812B816C\n:101AB0003C814D915C91CF01F9016081FA0109955A\n:101AC000E881F981A081B1812B813C814D915C91AC\n:101AD000CF01F9016181FA01099512E00AC0EB8199\n:101AE000FC81E10FF11D6081CE0170E00E94D80CF5\n:101AF0001F5F8A81181798F3CE010E940B0DDF91AA\n:101B0000CF911F910895FC01A081B181ED91FC91CD\n:101B100011970480F581E02DCD0109950895EF928C\n:101B2000FF920F931F938C017A01DC01ED91FC91E0\n:101B3000A081B1816F70606E2D913C91CF01F90150\n:101B40000995C801B7010E94D80C1F910F91FF9011\n:101B5000EF900895EF92FF920F931F937C018A01FB\n:101B6000DC01ED91FC91A081B1816F7060692D91D4\n:101B70003C91CF01F9010995D701ED91FC91A0812C\n:101B8000B181602F6F772D913C91CF01F9010995BB\n:101B9000D701ED91FC91A081B181000F012F001FB1\n:101BA000110B2D913C91CF01602FF90109951F91E7\n:101BB0000F91FF90EF900895DF92EF92FF920F93B5\n:101BC0001F93CF93DF93EC01162FD42E022FF32E09\n:101BD0000E94FE0CE881F981A081B1812D913C9198\n:101BE000CF01612FF9010995202F3F2DC9017C01FB\n:101BF00010E008C0F70161917F01CE0170E00E9402\n:101C0000D80C1F5F1D15B0F3CE010E940B0DDF91A4\n:101C1000CF911F910F91FF90EF90DF900895FC01FD\n:101C2000603DA9F0613D28F4603959F0603CA1F4B1\n:101C30000BC0603E19F0643F79F40CC054A743A771\n:101C4000089556A745A7089550AB47A7089552ABEE\n:101C500041AB089554AB43AB0895FC016F3F11F4C1\n:101C600056AB45AB0895FC0152AF41AF0895FC015E\n:101C7000158216821782DC0180E018961C92189754\n:101C80008F5F11968032C9F710A612A611A605A87B\n:101C9000F6A9E02D309709F009950895FC017183AC\n:101CA000608312820E94370E089584E793E060E417\n:101CB00074E00E944E0E08954F925F926F927F9251\n:101CC0008F929F92AF92BF92CF92DF92EF92FF924C\n:101CD0000F93DF93CF9300D0CDB7DEB72B017A01FE\n:101CE0003A8329838DE061E00E94291300E0898115\n:101CF0009A813C01882477FC8094982C5701CC244D\n:101D0000B7FCC094DC2C11C0C401B3010E940912BD\n:101D10008DE061E00E946813C601B5010E940912BE\n:101D20008DE060E00E9468130F5F802F90E08415C3\n:101D3000950554F30F900F90CF91DF910F91FF9085\n:101D4000EF90DF90CF90BF90AF909F908F907F905B\n:101D50006F905F904F9008950F931F938C018DE0CB\n:101D600061E00E942913C80162E070E048E250E09F\n:101D700022ED30E00E945C0E6AEF70E080E090E0BF\n:101D80000E940912C80163E070E048E250E022EDD1\n:101D900030E00E945C0E6DE770E080E090E00E9411\n:101DA00009121F910F9108959A01FA0101900020E4\n:101DB000E9F73197E41BF50B4E2F0E94DC0D0895D7\n:101DC000AB0161E70E94D40E08951F93CF93DF9378\n:101DD000EC018885813731F0893789F5CE010E9481\n:101DE0003F0D36C08FA998AD892B91F189A59AA591\n:101DF000019762E070E00E948416162F862F90E013\n:101E00000E947E10AC01DC0121E030E011C0FE0137\n:101E1000E20FF11D90859C932F5FFE01E20FF11DF3\n:101E20008085879588278795890F8D932F5F3F5FE2\n:101E3000311768F3EFA9F8ADCA01099509C0E9ADFA\n:101E4000FAAD309729F069A561502996AE01099540\n:101E5000DF91CF911F910895CF93DF93EC01A8817B\n:101E6000B981ED91FC9111970680F781E02DCD01AC\n:101E70000995AC0188A5882391F0473F510529F4C5\n:101E800018A6CE010E94E50E93C089A59AA5FE0171\n:101E9000E80FF91F408701969AA789A789C08D810D\n:101EA000882309F446C0403851050CF042C08150E7\n:101EB0008D83FE01E80FF11D4087882309F078C06B\n:101EC0008E81882309F474C0803D49F1813D28F456\n:101ED000803959F0803C59F51FC0803E19F0843F8D\n:101EE00031F513C0EBA5FCA502C0EDA5FEA530970A\n:101EF000F1F0688570E07695762F6627779567957F\n:101F00008985680F711D8F8111C0EBA9FCA93097DD\n:101F100071F06885898509C0EFA5F8A902C0E9A913\n:101F2000FAA9309721F068858F8170E009951E82AB\n:101F30003FC0403F510514F09A0106C09A01207F2E\n:101F40003070842F8F708F83203E3105F1F0213E59\n:101F5000310554F4203C3105D1F0203D3105B9F074\n:101F60002039310529F511C0243F310571F0253F95\n:101F7000310524F4203F3105D9F40DC0293F310546\n:101F800099F02F3F3105A1F40BC082E001C081E040\n:101F90008D832E830DC081E088A71AA619A608C0DC\n:101FA000CE010E94370E04C084E793E00E94180D12\n:101FB000DF91CF910895AF92BF92CF92DF92EF92CF\n:101FC000FF920F931F93CF93DF938C01D62EC72ED2\n:101FD000B42EA22E862F972F61EB71E00E94A900EC\n:101FE000EC018D2D9C2D6FE270E00E949E002097E9\n:101FF00079F07C010894E11CF11CE114F10441F03A\n:102000009E012E5F822F8E19D80112968C930FC0DD\n:10201000AD2DBC2DFD0101900020E9F7ED19EF5F1A\n:10202000D8011296EC932D2D3C2DC9017C01F801AD\n:10203000828190E00E947E10FC01D80114969C934E\n:102040008E93139712968C911297E80FF11D1082C0\n:102050001396ED91FC911497B0821396ED91FC913B\n:102060001497A18213968D919C91149712964C917E\n:1020700050E0425050400296B7010E948F00DF911D\n:10208000CF911F910F91FF90EF90DF90CF90BF9075\n:10209000AF9008950F931F938C0180E494E00E9409\n:1020A0004A14D801ED91FC9180914204909143042F\n:1020B000938382838091440490914504A0914604C7\n:1020C000B091470484839583A683B78380914804A5\n:1020D00090914904A0914A04B0914B048087918764\n:1020E000A287B387C8010E94AC0EC8010E94180DD8\n:1020F000C8010E943F0D1F910F9108950F931F93E8\n:10210000CF93DF93BC018230910510F462E070E060\n:10211000E0916404F0916504A0E0B0E040E050E09C\n:1021200024C08081918186179707D0F08617970782\n:1021300071F482819381109729F013969C938E936A\n:1021400012972CC0909365048093640427C04115B6\n:10215000510519F08417950718F4EF018D01AC01B2\n:10216000DF01828193819C01F9013097D1F64115FD\n:102170005105F9F0CA01861B970B8430910580F454\n:102180008A819B810115110521F0F80193838283D7\n:1021900004C09093650480936404FE01329645C0A8\n:1021A000FE01E80FF91F6193719302979983888369\n:1021B0003CC08091620490916304892B41F480912A\n:1021C000BB019091BC0190936304809362044091A1\n:1021D000BD015091BE014115510541F44DB75EB7A7\n:1021E0008091B9019091BA01481B590B209162046A\n:1021F0003091630424173507B0F4CA01821B930B96\n:102200008617970780F0AB014E5F5F4F84179507E5\n:1022100050F0420F531F5093630440936204F9013E\n:102220006193719302C0E0E0F0E0CF01DF91CF91C4\n:102230001F910F910895CF93DF939C01009709F4AC\n:102240008FC0EC0122971B821A8260916404709106\n:1022500065046115710581F488819981820F931F4E\n:1022600020916204309163042817390739F5D0931F\n:102270006304C093620474C0DB0140E050E0AC171B\n:10228000BD0708F1BB83AA83FE0121913191E20FC2\n:10229000F31FAE17BF0779F48D919C911197280F0A\n:1022A000391F2E5F3F4F3983288312968D919C9161\n:1022B00013979B838A834115510571F4D09365046C\n:1022C000C09364044DC012968D919C911397AD01FB\n:1022D000009711F0DC01D3CFDA011396DC93CE9393\n:1022E0001297FA0121913191E20FF31FCE17DF0708\n:1022F00069F488819981280F391F2E5F3F4FFA01B9\n:10230000318320838A819B8193838283E0E0F0E0A4\n:10231000DB0112968D919C911397009719F0BC01E7\n:10232000FD01F6CFAB014E5F5F4FDB018D919C91BC\n:10233000840F951F20916204309163042817390798\n:1023400079F4309729F4109265041092640402C065\n:1023500013821282425050405093630440936204AF\n:10236000DF91CF9108951F920F920FB60F92112413\n:102370002F933F938F939F93AF93BF938091B3031A\n:102380009091B403A091B503B091B6033091B70317\n:102390000196A11DB11D232F2D5F2D3720F02D5744\n:1023A0000196A11DB11D2093B7038093B3039093B1\n:1023B000B403A093B503B093B6038091AF0390919B\n:1023C000B003A091B103B091B2030196A11DB11D5C\n:1023D0008093AF039093B003A093B103B093B20383\n:1023E000BF91AF919F918F913F912F910F900FBE11\n:1023F0000F901F9018958FB7F8942091B3033091E8\n:10240000B4034091B5035091B6038FBFB901CA011F\n:1024100008959B01AC017FB7F8948091AF03909130\n:10242000B003A091B103B091B20366B5A89B05C0FB\n:102430006F3F19F00196A11DB11D7FBFBA2FA92FC3\n:10244000982F8827860F911DA11DB11D62E0880F6E\n:10245000991FAA1FBB1F6A95D1F7BC012DC0FFB7FA\n:10246000F8948091AF039091B003A091B103B09123\n:10247000B203E6B5A89B05C0EF3F19F00196A11D78\n:10248000B11DFFBFBA2FA92F982F88278E0F911D3E\n:10249000A11DB11DE2E0880F991FAA1FBB1FEA957D\n:1024A000D1F7861B970B885E9340C8F221503040CD\n:1024B0004040504068517C4F211531054105510580\n:1024C00071F60895019739F0880F991F880F991FA9\n:1024D00002970197F1F70895789484B5826084BDDE\n:1024E00084B5816084BD85B5826085BD85B5816018\n:1024F00085BDEEE6F0E0808181608083E1E8F0E078\n:102500001082808182608083808181608083E0E8A6\n:10251000F0E0808181608083E1EBF0E08081846085\n:102520008083E0EBF0E0808181608083EAE7F0E087\n:1025300080818460808380818260808380818160EB\n:1025400080838081806880831092C1000895982FD5\n:102550008E3008F09E5097708091BF018295880F51\n:10256000880F807C892B80937C0080917A00806426\n:1025700080937A0080917A0086FDFCCF20917800CC\n:1025800040917900942F80E030E0282B392BC9014D\n:1025900008951F93CF93DF93182FEB0161E00E9402\n:1025A0002913209709F44AC0CF3FD10509F449C047\n:1025B000E12FF0E0E255FF4F84918330C1F0843089\n:1025C00028F4813051F08230B1F50CC0863019F119\n:1025D000873049F1843079F514C084B5806884BDB2\n:1025E000C7BD33C084B5806284BDC8BD2EC0809194\n:1025F0008000806880938000D0938900C093880019\n:1026000024C080918000806280938000D0938B00F2\n:10261000C0938A001AC08091B00080688093B00097\n:10262000C093B30012C08091B00080628093B0006C\n:10263000C093B4000AC0C038D1051CF4812F60E0FB\n:1026400002C0812F61E00E946813DF91CF911F913A\n:102650000895CF93DF93482F50E0CA0186569F4FCD\n:10266000FC0134914A575F4FFA018491882369F144\n:1026700090E0880F991FFC01E859FF4FA591B49194\n:10268000FC01EE58FF4FC591D491662351F42FB74A\n:10269000F8948C91932F909589238C93888189232A\n:1026A0000BC0623061F42FB7F8948C91932F909502\n:1026B00089238C938881832B88832FBF06C09FB783\n:1026C000F8948C91832B8C939FBFDF91CF910895C9\n:1026D000482F50E0CA0182559F4FFC012491CA0146\n:1026E00086569F4FFC0194914A575F4FFA013491EF\n:1026F000332309F440C0222351F1233071F02430F8\n:1027000028F42130A1F0223011F514C02630B1F0A8\n:102710002730C1F02430D9F404C0809180008F7735\n:1027200003C0809180008F7D8093800010C084B5AD\n:102730008F7702C084B58F7D84BD09C08091B000C1\n:102740008F7703C08091B0008F7D8093B000E32F1E\n:10275000F0E0EE0FFF1FEE58FF4FA591B4912FB799\n:10276000F894662321F48C919095892302C08C9172\n:10277000892B8C932FBF089508951F920F920FB647\n:102780000F9211242F933F934F938F939F93EF9327\n:10279000FF938091C00082FD1DC04091C600209132\n:1027A000F8033091F9032F5F3F4F2F733070809102\n:1027B000FA039091FB032817390771F0E091F803B1\n:1027C000F091F903E854FC4F40833093F9032093D0\n:1027D000F80302C08091C600FF91EF919F918F9105\n:1027E0004F913F912F910F900FBE0F901F90189512\n:1027F000E0914C04F0914D04E05CFF4F8191919188\n:1028000020813181805C9F4F821B930B60E470E0DC\n:102810000E948416892B11F00E94BC1308951F9208\n:102820000F920FB60F9211242F933F938F939F9384\n:10283000EF93FF9320913C0430913D0480913E043E\n:1028400090913F042817390731F48091C1008F7DA2\n:102850008093C10014C0E0913E04F0913F04E45025\n:10286000FC4F208180913E0490913F0401968F732C\n:10287000907090933F0480933E042093C600FF9194\n:10288000EF919F918F913F912F910F900FBE0F90DD\n:102890001F901895AF92BF92DF92EF92FF920F9325\n:1028A0001F93CF93DF93EC017A018B01DD2440303D\n:1028B00081EE580780E0680780E0780711F0DD249A\n:1028C000D39491E0A92EB12CEC89FD89DD2069F02B\n:1028D000C50108A002C0880F991F0A94E2F78083FF\n:1028E00060E079E08DE390E005C0108260E874E874\n:1028F0008EE190E0A80197010E9497162150304088\n:1029000040405040569547953795279580E12030B7\n:10291000380720F0DD2011F0DD24D6CFE889F989D1\n:102920003083EA89FB89208319A2EE89FF894081DF\n:1029300021E030E0C9010C8C02C0880F991F0A9475\n:10294000E2F7482B4083EE89FF894081C9010D8C55\n:1029500002C0880F991F0A94E2F7482B4083EE8942\n:10296000FF894081C9010E8C02C0880F991F0A940B\n:10297000E2F7482B4083EE89FF8980810F8C02C0EB\n:10298000220F331F0A94E2F7209528232083DF913A\n:10299000CF911F910F91FF90EF90DF90BF90AF907C\n:1029A0000895DC011C96ED91FC911D97E05CFF4FB2\n:1029B0008191919120813181805C9F4F821B930B8B\n:1029C00060E470E00E9484160895DC011C96ED918D\n:1029D000FC911D97E05CFF4F20813181E054F04075\n:1029E000DF01AE5BBF4F8D919C911197281739077E\n:1029F00019F42FEF3FEF07C08D919C91E80FF91F5D\n:102A00008081282F30E0C9010895DC011C96ED91EA\n:102A1000FC911D97E05CFF4F20813181E054F04034\n:102A2000DF01AE5BBF4F8D919C911197281739073D\n:102A300019F42FEF3FEF10C08D919C911197E80F83\n:102A4000F91F20818D919C91119701968F73907041\n:102A500011969C938E9330E0C9010895DC01919604\n:102A60008C919197882339F05496ED91FC9155976C\n:102A7000808186FFF9CF91961C920895CF93DF93C2\n:102A8000EC01EE85FF85E05CFF4F20813181E05451\n:102A9000F0402F5F3F4F2F733070DF01AE5BBF4FB1\n:102AA0008D919C91119728173907D1F3E05CFF4F66\n:102AB00080819181E054F040E80FF91F6083EE853A\n:102AC000FF85E05CFF4F31832083EE89FF89208101\n:102AD00081E090E00F8C02C0880F991F0A94E2F702\n:102AE000282B208381E089A3EC89FD898081806483\n:102AF000808381E090E0DF91CF91089510924304AC\n:102B00001092420488EE93E0A0E0B0E08093440489\n:102B100090934504A0934604B093470484ED91E05C\n:102B2000909341048093400488EB93E090934D048C\n:102B300080934C048CEF93E090934F0480934E0469\n:102B400085EC90E0909351048093500484EC90E0E5\n:102B5000909353048093520480EC90E0909355043A\n:102B60008093540481EC90E0909357048093560432\n:102B700082EC90E0909359048093580486EC90E0A6\n:102B800090935B0480935A0484E080935C0483E018\n:102B900080935D0487E080935E0485E080935F040A\n:102BA00081E08093600408950895CF93DF930E949D\n:102BB0006C120E94D4150E943403C8EFD3E10E9426\n:102BC0004A042097E1F30E94F813F9CFCF92DF92E5\n:102BD000EF92FF920F931F93CF93DF937C016B01D2\n:102BE0008A01C0E0D0E00FC0D6016D916D01D70120\n:102BF000ED91FC910190F081E02DC7010995C80F7E\n:102C0000D91F015010400115110571F7CE01DF9158\n:102C1000CF911F910F91FF90EF90DF90CF9008958B\n:102C20002F923F924F925F926F927F928F929F92DC\n:102C3000AF92BF92CF92DF92EF92FF920F931F93CA\n:102C4000DF93CF93CDB7DEB73B014C0119012A01C9\n:102C50006D897E898F89988D6A197B098C099D09F8\n:102C6000621A730A840A950AA40193010E945916F4\n:102C7000E218F30804091509A80197010E94B91682\n:102C80002A0D3B1D4C1D5D1DB901CA01CF91DF917D\n:102C90001F910F91FF90EF90DF90CF90BF90AF907A\n:102CA0009F908F907F906F905F904F903F902F906C\n:102CB0000895629FD001739FF001829FE00DF11D86\n:102CC000649FE00DF11D929FF00D839FF00D749FA6\n:102CD000F00D659FF00D9927729FB00DE11DF91F52\n:102CE000639FB00DE11DF91FBD01CF0111240895AF\n:102CF000991B79E004C0991F961708F0961B881F4E\n:102D00007A95C9F78095089597FB092E07260AD072\n:102D100077FD04D049D006D000201AF47095619553\n:102D20007F4F0895F6F7909581959F4F0895A1E202\n:102D30001A2EAA1BBB1BFD010DC0AA1FBB1FEE1F35\n:102D4000FF1FA217B307E407F50720F0A21BB30B80\n:102D5000E40BF50B661F771F881F991F1A9469F7FC\n:102D600060957095809590959B01AC01BD01CF0158\n:102D7000089597FB092E05260ED057FD04D0D7DF06\n:102D80000AD0001C38F450954095309521953F4F5E\n:102D90004F4F5F4F0895F6F7909580957095619528\n:102DA0007F4F8F4F9F4F0895AA1BBB1B51E107C058\n:102DB000AA1FBB1FA617B70710F0A61BB70B881FCB\n:102DC000991F5A95A9F780959095BC01CD0108955A\n:102DD000EE0FFF1F0590F491E02D0994F894FFCFBA\n:102DE000556E6B6E6F776E2070696E206D6F6465C7\n:102DF000005374616E646172644669726D617461DE\n:102E00002E696E6F0049324320526561642045721D\n:102E1000726F723A20546F6F206D616E7920627903\n:102E20007465732072656365697665640049324331\n:102E30002052656164204572726F723A20546F6F40\n:102E400020666577206279746573207265636569B1\n:102E50007665640031302D62697420616464726546\n:102E60007373696E67206D6F6465206973206E6F80\n:102E7000742079657420737570706F727465640066\n:102E8000746F6F206D616E792071756572696573FD\n:102E9000002E637070001300FF80006604000001C4\n:102EA000000000000D0ADC0995099E09B309C40958\n:102EB000000000003E15E615D1140515E5142E1589\n:00000001FF";

var hex = intel_hex.parse(data).data;

//TODO standardize chip configs
//uno
var pageSize = 128;
var baud = 115200;
var delay1 = 1; //minimum is 2.5us, so anything over 1 fine?
var delay2 = 1;

var options = {
  devicecode:0,
  revision:0,
  progtype:0,
  parmode:0,
  polling:0,
  selftimed:0,
  lockbytes:0,
  fusebytes:0,
  flashpollval1:0,
  flashpollval2:0,
  eeprompollval1:0,
  eeprompollval2:0,
  pagesizehigh:0,
  pagesizelow:pageSize,
  eepromsizehigh:0,
  eepromsizelow:0,
  flashsize4:0,
  flashsize3:0,
  flashsize2:0,
  flashsize1:0
};


(function() {

function upload(done){


SerialPort.list(function (err, ports) {
	var found = false;
  ports.forEach(function(port) {

    console.log("found " + port.comName);

    if(usbttyRE.test(port.comName))
    {
    	found = true;

      console.log("trying" + port.comName);

      var serialPort = new SerialPort.SerialPort(port.comName, {
        baudrate: 115200,
        // parser: SerialPort.parsers.raw
      }, false);

      var programmer = new stk500(serialPort);

      async.series([
        programmer.connect.bind(programmer),
        programmer.reset.bind(programmer,delay1, delay2),
        programmer.sync.bind(programmer, 5),
        programmer.setOptions.bind(programmer, options),
        programmer.enterProgrammingMode.bind(programmer),
        programmer.upload.bind(programmer, hex, pageSize),
        programmer.exitProgrammingMode.bind(programmer),
        programmer.disconnect.bind(programmer)

      ], function(error){
        if(error){
          console.log("programing FAILED: " + error);

          done(new Error("programing FAILED: " + error));
        }else{
          console.log("programing SUCCESS!");
          done();
        }
      });

    }else{
      console.log("skipping " + port.comName);
    }

  });

	if(!found){
		console.log("not found");
		done(new Error("couldn't find an Arduino to program"));
	}

});

}


window.stk500 = {
  upload:upload
};


})(window);
